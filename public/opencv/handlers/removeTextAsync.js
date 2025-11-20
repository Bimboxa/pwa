async function removeTextAsync({ msg, payload }) {
  try {
    const {
      imageUrl,
      textThreshold = 127,
      morphKernelSize = 3,
      morphIterations = 1,
      minTextArea = 50,
      maxTextArea = 5000,
      inpaintRadius = 3,
    } = payload ?? {};

    if (!imageUrl) {
      throw new Error("imageUrl is required");
    }

    console.log("[removeTextAsync] Processing image");

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = cv.matFromImageData(imageData);

    const imageWidth = src.cols;
    const imageHeight = src.rows;

    // Convert to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Create binary image to detect text
    const binary = new cv.Mat();
    cv.threshold(gray, binary, textThreshold, 255, cv.THRESH_BINARY_INV);

    // Use morphological operations to detect text regions
    // Text typically appears as small connected components
    const kernelSize = Math.max(3, morphKernelSize | 0);
    const kernel = cv.Mat.ones(kernelSize, kernelSize, cv.CV_8U);

    // Close operation to connect nearby text pixels
    const closed = new cv.Mat();
    cv.morphologyEx(
      binary,
      closed,
      cv.MORPH_CLOSE,
      kernel,
      new cv.Point(-1, -1),
      Math.max(1, morphIterations | 0)
    );

    // Find contours to identify text regions
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      closed,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // Create mask for text regions
    const textMask = new cv.Mat();
    textMask.create(imageHeight, imageWidth, cv.CV_8UC1);
    textMask.setTo(new cv.Scalar(0, 0, 0, 0));

    // Filter contours by area to identify text regions
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Text regions are typically small to medium sized
      if (area >= minTextArea && area <= maxTextArea) {
        // Draw filled contour on mask (single channel, so use single value scalar)
        cv.drawContours(textMask, contours, i, new cv.Scalar(255), -1);
      }
      contour.delete();
    }

    // Dilate the mask slightly to ensure complete text removal
    const dilatedMask = new cv.Mat();
    const dilateKernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(textMask, dilatedMask, dilateKernel, new cv.Point(-1, -1), 1);

    // Convert source to RGB for inpainting (inpaint requires 8UC3, not 8UC4)
    const srcRgb = new cv.Mat();
    cv.cvtColor(src, srcRgb, cv.COLOR_RGBA2RGB);

    // Use inpainting to fill text regions
    const resultRgb = new cv.Mat();
    cv.inpaint(srcRgb, dilatedMask, resultRgb, inpaintRadius, cv.INPAINT_TELEA);

    // Convert back to RGBA for output
    const result = new cv.Mat();
    cv.cvtColor(resultRgb, result, cv.COLOR_RGB2RGBA);

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
      console.error("[removeTextAsync] Failed to create result image:", error);
    }

    // Cleanup
    src.delete();
    gray.delete();
    binary.delete();
    kernel.delete();
    closed.delete();
    contours.delete();
    hierarchy.delete();
    textMask.delete();
    dilatedMask.delete();
    dilateKernel.delete();
    srcRgb.delete();
    resultRgb.delete();
    result.delete();

    // Convert blob to base64 for transfer (chunked to avoid stack overflow)
    let resultImageBase64 = null;
    if (resultImageBlob) {
      const arrayBuffer = await resultImageBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Process in chunks to avoid stack overflow with large images
      const chunkSize = 8192; // Process 8KB at a time
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
        resultImageBase64, // Base64 encoded PNG
      },
    });
  } catch (error) {
    console.error("[opencv worker] removeTextAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}

