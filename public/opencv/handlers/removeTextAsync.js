/**
 * Enhanced Text Removal for Floor Plans/CAD
 */
async function removeTextAsync({ msg, payload }) {
  const matList = [];
  const track = (mat) => {
    if (mat) matList.push(mat);
    return mat;
  };

  try {
    const {
      imageUrl,
      bbox,
      // --- Configuration ---
      // Inpainting radius
      inpaintRadius = 3,
      // Area filters (min/max size of text blobs)
      minTextArea = 15, // Lowered for small punctuation/letters
      maxTextArea = 1500,
      // Geometric filters to distinguish text from walls
      minSolidity = 0.2, // Text is usually somewhat dense
      maxAspectRatio = 4.0, // Text isn't usually 10x wider than tall
      // Morphological settings
      morphKernelSize = 3,
      // Set this to true to see the mask being used for debugging (returns mask instead of result)
      debugMask = false,
    } = payload ?? {};

    if (!imageUrl) throw new Error("imageUrl is required");

    console.log("[removeTextAsync] Processing CAD/Floorplan image");

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = track(cv.matFromImageData(imageData));

    // --- ROI Setup ---
    let workingMat;
    let roiRect = null;
    let roiX = 0,
      roiY = 0;

    if (bbox && bbox.width && bbox.height) {
      const x = Math.max(0, Math.floor(bbox.x));
      const y = Math.max(0, Math.floor(bbox.y));
      const w = Math.min(src.cols - x, Math.floor(bbox.width));
      const h = Math.min(src.rows - y, Math.floor(bbox.height));

      if (w > 0 && h > 0) {
        roiRect = new cv.Rect(x, y, w, h);
        workingMat = track(src.roi(roiRect));
        roiX = x;
        roiY = y;
      } else {
        workingMat = src;
      }
    } else {
      workingMat = src;
    }

    // --- 1. Pre-processing ---
    const gray = track(new cv.Mat());
    cv.cvtColor(workingMat, gray, cv.COLOR_RGBA2GRAY);

    // Use Adaptive Thresholding for CAD drawings
    // This is better for clear lines vs white background
    const binary = track(new cv.Mat());
    cv.adaptiveThreshold(
      gray,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      11,
      2
    );

    // --- 2. Line Isolation (The "Wall Protection" Step) ---
    // We detect long horizontal and vertical lines and REMOVE them from the binary map
    // so they don't get detected as text.

    const linesMask = track(
      new cv.Mat.zeros(binary.rows, binary.cols, cv.CV_8UC1)
    );

    // Detect Horizontal Lines
    const hKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(20, 1))
    );
    const hLines = track(new cv.Mat());
    cv.morphologyEx(binary, hLines, cv.MORPH_OPEN, hKernel);

    // Detect Vertical Lines
    const vKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, 20))
    );
    const vLines = track(new cv.Mat());
    cv.morphologyEx(binary, vLines, cv.MORPH_OPEN, vKernel);

    // Combine lines
    cv.add(hLines, vLines, linesMask);

    // Subtract lines from the original binary image
    // 'textCandidates' will now contain text, noise, and diagonal hatching, but NOT main walls
    const textCandidates = track(new cv.Mat());
    cv.subtract(binary, linesMask, textCandidates);

    // --- 3. Morphological Connection ---
    // Connect nearby letters into words
    const connectKernel = track(
      cv.getStructuringElement(
        cv.MORPH_ELLIPSE,
        new cv.Size(morphKernelSize, morphKernelSize)
      )
    );
    const connected = track(new cv.Mat());
    cv.morphologyEx(textCandidates, connected, cv.MORPH_CLOSE, connectKernel);

    // --- 4. Contour Filtering ---
    const contours = track(new cv.MatVector());
    const hierarchy = track(new cv.Mat());
    cv.findContours(
      connected,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // Create the final inpainting mask
    const mask = track(
      new cv.Mat.zeros(workingMat.rows, workingMat.cols, cv.CV_8UC1)
    );

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      const rect = cv.boundingRect(cnt);

      // heuristic 1: Area
      if (area < minTextArea || area > maxTextArea) {
        cnt.delete();
        continue;
      }

      // heuristic 2: Aspect Ratio
      // Text usually fits in a box. Walls are extremely long and thin.
      const aspectRatio = rect.width / rect.height;
      if (aspectRatio > maxAspectRatio || aspectRatio < 1 / maxAspectRatio) {
        cnt.delete(); // It's likely a leftover line fragment
        continue;
      }

      // heuristic 3: Solidity
      // (Area of shape) / (Area of bounding box).
      // Noise is often sparse. Text is dense.
      const rectArea = rect.width * rect.height;
      const solidity = area / rectArea;
      if (solidity < minSolidity) {
        cnt.delete();
        continue;
      }

      // If it passes, draw it on the mask
      // We draw the CONVEX HULL or the Bounding Rect to ensure we cover the whole word
      // For CAD text, drawing the rectangle is often safer to cover anti-aliasing edges
      const point1 = new cv.Point(rect.x, rect.y);
      const point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);
      cv.rectangle(mask, point1, point2, new cv.Scalar(255), -1);

      cnt.delete();
    }

    // Dilate mask slightly to grab edge artifacts
    const dilateKernel = track(cv.Mat.ones(3, 3, cv.CV_8U));
    cv.dilate(mask, mask, dilateKernel, new cv.Point(-1, -1), 1);

    // --- 5. Inpainting ---
    // Convert to RGB (OpenCV inpaint expects 3 channels)
    const srcRgb = track(new cv.Mat());
    cv.cvtColor(workingMat, srcRgb, cv.COLOR_RGBA2RGB);

    const resRgb = track(new cv.Mat());

    if (debugMask) {
      // If debugging, return the B&W mask to see what we are trying to delete
      cv.cvtColor(mask, resRgb, cv.COLOR_GRAY2RGB);
    } else {
      // Telea is usually good, but sometimes NS (Navier-Stokes) preserves lines better.
      // For simple text removal, Telea is faster.
      cv.inpaint(srcRgb, mask, resRgb, inpaintRadius, cv.INPAINT_TELEA);
    }

    // Convert back to RGBA
    const resRgba = track(new cv.Mat());
    cv.cvtColor(resRgb, resRgba, cv.COLOR_RGB2RGBA);

    // Copy result back to workingMat (which updates src due to ROI linkage)
    resRgba.copyTo(workingMat);

    // --- 6. Output ---
    let resultImageBlob = null;
    try {
      const resultImageData = imageDataFromMat(src);
      const canvas = new OffscreenCanvas(
        resultImageData.width,
        resultImageData.height
      );
      const ctx = canvas.getContext("2d");
      ctx.putImageData(resultImageData, 0, 0);
      resultImageBlob = await canvas.convertToBlob({ type: "image/png" });
    } catch (err) {
      console.error("Blob creation failed", err);
    }

    let resultImageBase64 = null;
    if (resultImageBlob) {
      const buf = await resultImageBlob.arrayBuffer();
      const arr = new Uint8Array(buf);
      const CHUNK = 8192;
      let bin = "";
      for (let i = 0; i < arr.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, arr.slice(i, i + CHUNK));
      }
      resultImageBase64 = btoa(bin);
    }

    postMessage({ msg, payload: { resultImageBase64 } });
  } catch (error) {
    console.error(error);
    postMessage({ msg, error: error.message });
  } finally {
    matList.forEach((m) => m && !m.isDeleted() && m.delete());
  }
}
