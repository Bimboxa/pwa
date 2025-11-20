async function removeColoredContentAsync({ msg, payload }) {
  try {
    const {
      imageUrl,
      colorTolerance = 0.05, // 5% maps to saturation threshold
      minColoredArea = 50, // Minimum area to consider as colored region
      morphKernelSize = 3,
      morphIterations = 1,
      blackProtectionThreshold = 0.3, // 30% brightness: pixels darker than this are protected (kept)
      enableMaskDilation = false, // Dilation disabled by default to protect fine details
      dilationIterations = 1,
    } = payload ?? {};

    if (!imageUrl) {
      throw new Error("imageUrl is required");
    }

    console.log("[removeColoredContentAsync] Processing image");

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = cv.matFromImageData(imageData); // Source is RGBA

    const imageWidth = src.cols;
    const imageHeight = src.rows;

    // Convert to RGB for processing
    const rgb = new cv.Mat();
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

    // Convert to HSV to detect color intensity AND brightness
    const hsv = new cv.Mat();
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);

    // Split channels: 1=Saturation, 2=Value (Brightness)
    const channels = new cv.MatVector();
    cv.split(hsv, channels);
    const saturation = channels.get(1);
    const value = channels.get(2);

    // 1. Create MASK for Colored pixels (High Saturation)
    const coloredMask = new cv.Mat();
    const saturationThreshold = Math.max(10, colorTolerance * 255);
    cv.threshold(
      saturation,
      coloredMask,
      saturationThreshold,
      255,
      cv.THRESH_BINARY
    );

    // 2. Create MASK for Dark pixels (Low Value) - These are likely ink/lines
    const darkMask = new cv.Mat();
    // Pixels darker than threshold (e.g., 30% gray) are considered "ink" to protect
    const valueThreshold = blackProtectionThreshold * 255;
    cv.threshold(value, darkMask, valueThreshold, 255, cv.THRESH_BINARY_INV);

    // 3. Refine Colored Mask: Remove dark pixels from the colored selection
    // Logic: If it's colored BUT it's also very dark, it's probably black ink mixed with color artifacts. Keep it.
    // We subtract the darkMask from coloredMask.
    cv.subtract(coloredMask, darkMask, coloredMask);

    // Debug: check how many colored pixels were detected
    const coloredPixels = cv.countNonZero(coloredMask);
    console.log(
      `[removeColoredContentAsync] Detected ${coloredPixels} colored pixels out of ${
        imageWidth * imageHeight
      } total`
    );

    // Use morphological operations to clean up the mask
    const kernelSize = Math.max(3, morphKernelSize | 0);
    const kernel = cv.Mat.ones(kernelSize, kernelSize, cv.CV_8U);

    // Close operation to connect nearby colored pixels
    const closed = new cv.Mat();
    cv.morphologyEx(
      coloredMask,
      closed,
      cv.MORPH_CLOSE,
      kernel,
      new cv.Point(-1, -1),
      Math.max(1, morphIterations | 0)
    );

    // Find contours to identify colored regions
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      closed,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // Create refined mask for colored regions
    const refinedMask = new cv.Mat();
    refinedMask.create(imageHeight, imageWidth, cv.CV_8UC1);
    refinedMask.setTo(new cv.Scalar(0));

    // Filter contours by area
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area >= minColoredArea) {
        cv.drawContours(refinedMask, contours, i, new cv.Scalar(255), -1);
      }
      contour.delete();
    }

    // OPTIONAL: Dilate the mask
    // If enabled, this expands the mask to catch anti-aliasing pixels around the color.
    // Disabled by default to avoid eating into adjacent black lines (hachures).
    if (enableMaskDilation) {
      const dilateKernel = cv.Mat.ones(3, 3, cv.CV_8U);
      const dilated = new cv.Mat();
      cv.dilate(
        refinedMask,
        dilated,
        dilateKernel,
        new cv.Point(-1, -1),
        Math.max(1, dilationIterations | 0)
      );
      dilated.copyTo(refinedMask);
      dilated.delete();
      dilateKernel.delete();
    }

    // 4. FINAL PROTECTION
    // Before applying the mask, we enforce the dark protection again on the refined mask.
    // This ensures that even if a contour "swallowed" a black line (via close or dilation), we carve it back out.
    cv.subtract(refinedMask, darkMask, refinedMask);

    // Apply the mask to the result
    const result = src.clone();
    const whiteColor = new cv.Scalar(255, 255, 255, 255);
    result.setTo(whiteColor, refinedMask);

    // Convert result to image blob
    let resultImageBlob = null;
    try {
      const resultImageData = imageDataFromMat(result);

      const canvas = new OffscreenCanvas(
        resultImageData.width,
        resultImageData.height
      );
      const ctx = canvas.getContext("2d");
      ctx.putImageData(resultImageData, 0, 0);

      resultImageBlob = await canvas.convertToBlob({ type: "image/png" });
    } catch (error) {
      console.error(
        "[removeColoredContentAsync] Failed to create result image:",
        error
      );
    }

    // Cleanup
    src.delete();
    rgb.delete();
    hsv.delete();
    channels.delete();
    saturation.delete();
    value.delete();
    coloredMask.delete();
    darkMask.delete();
    kernel.delete();
    closed.delete();
    contours.delete();
    hierarchy.delete();
    refinedMask.delete();
    result.delete();

    // Convert blob to base64
    let resultImageBase64 = null;
    if (resultImageBlob) {
      const arrayBuffer = await resultImageBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const chunkSize = 8192;
      let binaryString = "";
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, chunk);
      }
      resultImageBase64 = btoa(binaryString);
    }

    postMessage({
      msg,
      payload: {
        resultImageBase64,
      },
    });
  } catch (error) {
    console.error("[opencv worker] removeColoredContentAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}
