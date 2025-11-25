/* Assumes loadImageDataFromUrl and imageDataFromMat exist in your worker scope 
  as per your provided snippet.
*/

async function fillHatchAsync({ msg, payload }) {
  // Keep track of mats to delete them later to avoid memory leaks
  const trash = [];

  try {
    const { imageUrl, hatchPatternUrl, bbox, threshold = 0.8 } = payload ?? {};

    if (!imageUrl) throw new Error("imageUrl is required");
    if (!hatchPatternUrl)
      throw new Error("hatchPatternUrl is required for detection");

    // 1. Load Main Image
    const mainImageData = await loadImageDataFromUrl(imageUrl);
    const src = cv.matFromImageData(mainImageData);
    trash.push(src);

    // 2. Load Hatch Pattern (Template)
    const hatchImageData = await loadImageDataFromUrl(hatchPatternUrl);
    const templ = cv.matFromImageData(hatchImageData);
    trash.push(templ);

    // Convert to grayscale for better matching (optional but recommended)
    const srcGray = new cv.Mat();
    const templGray = new cv.Mat();
    trash.push(srcGray, templGray);

    cv.cvtColor(src, srcGray, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(templ, templGray, cv.COLOR_RGBA2GRAY);

    // 3. Create Result Matrix
    // The result size of matchTemplate is (W - w + 1) x (H - h + 1)
    const resultRows = src.rows - templ.rows + 1;
    const resultCols = src.cols - templ.cols + 1;

    if (resultRows <= 0 || resultCols <= 0) {
      throw new Error("Hatch pattern is larger than the main image.");
    }

    const result = new cv.Mat();
    trash.push(result);

    // 4. Perform Template Matching
    // TM_CCOEFF_NORMED is robust for texture matching. 1 = perfect match, -1 = inverted.
    cv.matchTemplate(srcGray, templGray, result, cv.TM_CCOEFF_NORMED);

    // 5. Threshold the result
    // We only want strong matches (e.g., > 0.8 correlation)
    const mask = new cv.Mat();
    trash.push(mask);

    // Threshold returns a binary map of 32F. We convert to 8UC1 for using as a mask.
    cv.threshold(result, mask, threshold, 255, cv.THRESH_BINARY);

    const mask8U = new cv.Mat();
    trash.push(mask8U);
    mask.convertTo(mask8U, cv.CV_8UC1);

    // 6. Pad the Mask to match Source Size
    // matchTemplate result is smaller. We pad the Right and Bottom to align coordinates.
    const paddedMask = new cv.Mat();
    trash.push(paddedMask);
    cv.copyMakeBorder(
      mask8U,
      paddedMask,
      0, // top
      templ.rows - 1, // bottom
      0, // left
      templ.cols - 1, // right
      cv.BORDER_CONSTANT,
      new cv.Scalar(0, 0, 0, 0)
    );

    // 7. Dilate the Mask (The "Stamp" Effect)
    // The match is just a dot at the top-left. We need to fill the area of the pattern size.
    // We use the pattern size as the kernel for dilation.
    const kernel = cv.Mat.ones(templ.rows, templ.cols, cv.CV_8U);
    trash.push(kernel);

    const dilatedMask = new cv.Mat();
    trash.push(dilatedMask);

    const anchor = new cv.Point(-1, -1); // Center anchor
    cv.dilate(
      paddedMask,
      dilatedMask,
      kernel,
      anchor,
      1,
      cv.BORDER_CONSTANT,
      cv.morphologyDefaultBorderValue()
    );

    // 8. Apply Flash Green Color
    // Flash Green in RGBA: [0, 255, 0, 255]
    // We create a Vector of Mats to merge, or use setTo with mask

    // Approach: Create a Green Mat and copy it over src where mask is white
    const greenColor = new cv.Scalar(0, 255, 0, 255); // R, G, B, A

    // If bbox is provided, we can apply a secondary mask (intersection)
    // to ensure we only search/color inside the bbox if requested.
    // (Optional: If you strictly want to restrict processing to bbox, crop src earlier)

    // Set the pixels in src to Green where dilatedMask is non-zero
    src.setTo(greenColor, dilatedMask);

    // 9. Convert back to Base64
    let resultImageBase64 = null;
    try {
      // Use the helper imageDataFromMat (assumed to exist in worker)
      const resultImageData = imageDataFromMat(src);

      const canvas = new OffscreenCanvas(
        resultImageData.width,
        resultImageData.height
      );
      const ctx = canvas.getContext("2d");
      ctx.putImageData(resultImageData, 0, 0);

      const blob = await canvas.convertToBlob({ type: "image/png" });
      const arrayBuffer = await blob.arrayBuffer();

      // Efficient Buffer to Base64
      const uint8Array = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binaryString = "";
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, chunk);
      }
      resultImageBase64 = btoa(binaryString);
    } catch (error) {
      console.error(
        "[fillHatchAsync] Failed to convert result to base64",
        error
      );
    }

    postMessage({
      msg,
      payload: {
        resultImageBase64,
      },
    });
  } catch (error) {
    console.error("[opencv worker] fillHatchAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  } finally {
    // Clean up all OpenCV objects to prevent memory leaks in WASM
    trash.forEach((mat) => {
      if (mat && !mat.isDeleted()) mat.delete();
    });
  }
}
