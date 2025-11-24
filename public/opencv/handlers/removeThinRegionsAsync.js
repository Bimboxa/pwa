async function removeThinRegionsAsync({ msg, payload }) {
  const matList = [];
  // Helper to auto-manage memory
  const track = (mat) => {
    if (mat) matList.push(mat);
    return mat;
  };

  try {
    const {
      imageUrl,
      bbox,
      // 0-255. How dark must a pixel be to be considered "not background".
      whiteThreshold = 250,

      // Features thinner than this number of pixels will be removed.
      thinLineThresholdPx = 5,

      // NEW PARAMETER:
      // Any remaining isolated specks smaller than this area (in pixels) will be erased at the end.
      // Try values between 10 and 50.
      noiseThresholdArea = 30,
    } = payload ?? {};

    if (!imageUrl) throw new Error("imageUrl is required");
    if (thinLineThresholdPx < 1)
      throw new Error("thinLineThresholdPx must be >= 1");

    const imageData = await loadImageDataFromUrl(imageUrl);
    // Keep the original color image as 'src'
    const src = track(cv.matFromImageData(imageData));

    // --- SAFE ROI HANDLING ---
    let workingMat;
    if (bbox && bbox.width && bbox.height) {
      const x = Math.max(0, Math.floor(bbox.x));
      const y = Math.max(0, Math.floor(bbox.y));
      const w = Math.min(src.cols - x, Math.floor(bbox.width));
      const h = Math.min(src.rows - y, Math.floor(bbox.height));

      if (w <= 0 || h <= 0) workingMat = src;
      else workingMat = track(src.roi(new cv.Rect(x, y, w, h)));
    } else {
      workingMat = src;
    }

    // --- STEP 1: Create a mask of ALL non-white content ---
    const gray = track(new cv.Mat());
    cv.cvtColor(workingMat, gray, cv.COLOR_RGBA2GRAY);

    const allContentMask = track(new cv.Mat());
    // Threshold: Anything darker than whiteThreshold becomes White (255).
    cv.threshold(
      gray,
      allContentMask,
      whiteThreshold,
      255,
      cv.THRESH_BINARY_INV
    );

    // --- STEP 2: Create a mask of ONLY THICK content ---
    const kSize = Math.floor(thinLineThresholdPx) + 1;
    // Using ELLIPSE is generally better for irregular shapes than RECT
    const kernel = track(
      cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(kSize, kSize))
    );

    const thickContentMask = track(new cv.Mat());
    // Apply opening to keep only thick features.
    cv.morphologyEx(
      allContentMask,
      thickContentMask,
      cv.MORPH_OPEN,
      kernel,
      new cv.Point(-1, -1),
      1
    );

    // --- STEP 3: Identify THIN content (The Difference) ---
    const thinContentMask = track(new cv.Mat());
    cv.subtract(allContentMask, thickContentMask, thinContentMask);

    // Dilate the thin mask slightly to ensure we capture anti-aliased edges.
    // Increased dilation slightly to grab more of the fuzzy edges.
    const dilateKernel = track(
      cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3))
    );
    cv.dilate(thinContentMask, thinContentMask, dilateKernel);

    // --- STEP 4: Apply Initial Removal to Image ---
    const whiteFill = track(
      new cv.Mat(
        workingMat.rows,
        workingMat.cols,
        workingMat.type(),
        new cv.Scalar(255, 255, 255, 255)
      )
    );
    // Paint white over the thin content areas
    whiteFill.copyTo(workingMat, thinContentMask);

    // ==================================================================
    // --- STEP 5: Post-Processing Despeckle (Clean up the dots) ---
    // ==================================================================

    // 5a. Analyze the *current state* of the result image to find remaining noise.
    const resultGray = track(new cv.Mat());
    cv.cvtColor(workingMat, resultGray, cv.COLOR_RGBA2GRAY);

    // Find anything that isn't perfectly white in the result.
    const noiseMask = track(new cv.Mat());
    // Use a very strict threshold here (e.g., 254) to catch faint colored specks.
    // Invert: Noise becomes White (255), Background stays Black (0).
    cv.threshold(resultGray, noiseMask, 254, 255, cv.THRESH_BINARY_INV);

    // 5b. Find contours of these noise candidates.
    const noiseContours = track(new cv.MatVector());
    const noiseHierarchy = track(new cv.Mat());
    cv.findContours(
      noiseMask,
      noiseContours,
      noiseHierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // 5c. Filter by size and erase small ones.
    for (let i = 0; i < noiseContours.size(); i++) {
      const cnt = noiseContours.get(i);
      const area = cv.contourArea(cnt);

      // If it's smaller than our noise threshold, it's a dot to be removed.
      // Important: We don't want to remove the large thick walls we just saved.
      if (area > 0 && area < noiseThresholdArea) {
        // Draw filled white contour directly onto the result image
        cv.drawContours(
          workingMat,
          noiseContours,
          i,
          new cv.Scalar(255, 255, 255, 255),
          -1
        );
      }
    }

    // ==================================================================

    // --- Output Generation ---
    const resultImageData = imageDataFromMat(src);
    const canvas = new OffscreenCanvas(
      resultImageData.width,
      resultImageData.height
    );
    const ctx = canvas.getContext("2d");
    ctx.putImageData(resultImageData, 0, 0);

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const buf = await blob.arrayBuffer();
    let bin = "";
    const arr = new Uint8Array(buf);
    const chunkSize = 8192;
    for (let i = 0; i < arr.length; i += chunkSize) {
      bin += String.fromCharCode.apply(null, arr.slice(i, i + chunkSize));
    }
    const resultImageBase64 = btoa(bin);

    postMessage({ msg, payload: { resultImageBase64 } });
  } catch (err) {
    let errorMessage = err;
    if (typeof err === "number") {
      try {
        if (cv.exceptionFromPtr) errorMessage = cv.exceptionFromPtr(err).msg;
      } catch (e) {
        errorMessage = `Unknown C++ Exception Pointer: ${err}`;
      }
    } else if (err?.message) {
      errorMessage = err.message;
    }
    console.error("[opencv worker] removeThinRegionsAsync failed", errorMessage);
    postMessage({ msg, error: errorMessage });
  } finally {
    // Clean up memory
    matList.forEach((m) => m && !m.isDeleted() && m.delete());
  }
}

