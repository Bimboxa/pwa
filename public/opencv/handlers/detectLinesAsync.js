async function detectLinesAsync({ msg, payload }) {
  const matList = [];
  const track = (mat) => {
    if (mat) matList.push(mat);
    return mat;
  };

  try {
    const { imageUrl, x, y, windowSize = 50 } = payload ?? {};

    if (!imageUrl || x === undefined || y === undefined) {
      throw new Error("imageUrl, x, and y are required");
    }

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = track(cv.matFromImageData(imageData));

    const imageWidth = src.cols;
    const imageHeight = src.rows;

    // Calculate ROI bounds (50x50px window centered at x, y)
    const halfSize = Math.floor(windowSize / 2);
    const startX = Math.max(0, Math.min(imageWidth - windowSize, Math.floor(x - halfSize)));
    const startY = Math.max(0, Math.min(imageHeight - windowSize, Math.floor(y - halfSize)));
    const roiWidth = Math.min(windowSize, imageWidth - startX);
    const roiHeight = Math.min(windowSize, imageHeight - startY);

    if (roiWidth <= 0 || roiHeight <= 0) {
      src.delete();
      postMessage({
        msg,
        payload: {
          lines: [],
          imageBase64: null,
        },
      });
      return;
    }

    const roiRect = new cv.Rect(startX, startY, roiWidth, roiHeight);
    const roi = track(src.roi(roiRect));

    // Convert to grayscale
    const gray = track(new cv.Mat());
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);

    // Apply Canny edge detection
    const edges = track(new cv.Mat());
    cv.Canny(gray, edges, 50, 150);

    // Detect lines using HoughLinesP
    const lines = track(new cv.Mat());
    cv.HoughLinesP(
      edges,
      lines,
      1, // rho resolution
      Math.PI / 180, // theta resolution (1 degree)
      50, // threshold (minimum votes)
      10, // minLineLength
      5 // maxLineGap
    );

    // Extract line segments and classify as horizontal or vertical
    const horizontalLines = [];
    const verticalLines = [];

    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4];
      const y1 = lines.data32S[i * 4 + 1];
      const x2 = lines.data32S[i * 4 + 2];
      const y2 = lines.data32S[i * 4 + 3];

      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Classify as horizontal (0-15° or 165-180°) or vertical (75-105°)
      if (angle < 15 || angle > 165) {
        horizontalLines.push({ x1, y1, x2, y2 });
      } else if (angle > 75 && angle < 105) {
        verticalLines.push({ x1, y1, x2, y2 });
      }
    }

    // Create output image with detected lines drawn in red
    const output = track(roi.clone());
    const red = new cv.Scalar(255, 0, 0, 255);

    // Draw horizontal lines
    horizontalLines.forEach((line) => {
      const pt1 = new cv.Point(line.x1, line.y1);
      const pt2 = new cv.Point(line.x2, line.y2);
      cv.line(output, pt1, pt2, red, 2);
    });

    // Draw vertical lines
    verticalLines.forEach((line) => {
      const pt1 = new cv.Point(line.x1, line.y1);
      const pt2 = new cv.Point(line.x2, line.y2);
      cv.line(output, pt1, pt2, red, 2);
    });

    // Convert to base64
    let resultImageBase64 = null;
    try {
      const resultImageData = imageDataFromMat(output);
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
      resultImageBase64 = btoa(bin);
    } catch (error) {
      console.error("[detectLinesAsync] Failed to convert result to base64", error);
    }

    postMessage({
      msg,
      payload: {
        lines: {
          horizontal: horizontalLines,
          vertical: verticalLines,
        },
        imageBase64: resultImageBase64,
      },
    });
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
    console.error("[opencv worker] detectLinesAsync failed", errorMessage);
    postMessage({ msg, error: errorMessage });
  } finally {
    matList.forEach((m) => m && !m.isDeleted() && m.delete());
  }
}

