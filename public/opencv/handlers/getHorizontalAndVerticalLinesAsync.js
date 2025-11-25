/**
 * Selects a connected structure and returns its outline as geometric polylines.
 * Returns relative coordinates (0.0 to 1.0).
 */
async function getHorizontalAndVerticalLinesAsync({ msg, payload }) {
  const matList = [];
  const track = (mat) => {
    if (mat) matList.push(mat);
    return mat;
  };

  try {
    const {
      imageUrl,
      x,
      y,
      tolerance = 30,
      minSegmentLength = 10,
      strictOrthogonal = true,
      // Simplification factor: Higher = simpler shapes, fewer points.
      // 2.0 is a good balance for pixelated wall edges.
      approxEpsilon = 2.0,
    } = payload ?? {};

    if (!imageUrl || x === undefined || y === undefined) {
      throw new Error("imageUrl, x, and y are required");
    }

    // 1. Load Image
    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = track(cv.matFromImageData(imageData));

    const width = src.cols;
    const height = src.rows;

    if (x < 0 || y < 0 || x >= width || y >= height) {
      throw new Error("Start point is out of bounds");
    }

    // 2. Flood Fill (Isolation)
    const mask = track(new cv.Mat.zeros(height + 2, width + 2, cv.CV_8UC1));
    const seedPoint = new cv.Point(Math.floor(x), Math.floor(y));

    // Flood fill flags (4-connectivity)
    const flags =
      4 | (255 << 8) | cv.FLOODFILL_MASK_ONLY | cv.FLOODFILL_FIXED_RANGE;
    const loDiff = new cv.Scalar(tolerance, tolerance, tolerance, 0);
    const upDiff = new cv.Scalar(tolerance, tolerance, tolerance, 0);

    const rect = new cv.Rect();
    cv.floodFill(
      src,
      mask,
      seedPoint,
      new cv.Scalar(255),
      rect,
      loDiff,
      upDiff,
      flags
    );

    // Crop mask to image size
    const rawMask = track(mask.roi(new cv.Rect(1, 1, width, height)));

    // 3. Enforce Orthogonal Geometry
    const finalMask = track(new cv.Mat.zeros(height, width, cv.CV_8UC1));

    if (strictOrthogonal) {
      // Horizontal Pass
      const hKernel = track(
        cv.getStructuringElement(
          cv.MORPH_RECT,
          new cv.Size(minSegmentLength, 1)
        )
      );
      const hMat = track(new cv.Mat());
      cv.morphologyEx(rawMask, hMat, cv.MORPH_OPEN, hKernel);

      // Vertical Pass
      const vKernel = track(
        cv.getStructuringElement(
          cv.MORPH_RECT,
          new cv.Size(1, minSegmentLength)
        )
      );
      const vMat = track(new cv.Mat());
      cv.morphologyEx(rawMask, vMat, cv.MORPH_OPEN, vKernel);

      // Combine
      cv.bitwise_or(hMat, vMat, finalMask);
    } else {
      rawMask.copyTo(finalMask);
    }

    // 4. Extract Geometries (Contours)
    const contours = track(new cv.MatVector());
    const hierarchy = track(new cv.Mat());

    // RETR_EXTERNAL: We only want the outer boundary of the wall, not holes inside it.
    // CHAIN_APPROX_SIMPLE: Compresses horizontal, vertical, and diagonal segments.
    cv.findContours(
      finalMask,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    const polylines = [];

    // 5. Convert Contours to Simplified Polylines
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const approx = track(new cv.Mat());

      // approxPolyDP simplifies the curve.
      // Since our mask is already "blocky" from step 3, this will produce clean corners.
      // We calculate epsilon based on arc length for scale invariance, or use fixed pixel value.
      // Using a fixed small pixel value (e.g. 2px) is often safer for strict CAD grids.
      cv.approxPolyDP(contour, approx, approxEpsilon, true);

      // Extract points from the Mat (Format is CV_32SC2: 32-bit signed integers, 2 channels X/Y)
      const points = [];
      const data = approx.data32S; // Int32Array view of the data

      for (let j = 0; j < approx.rows; j++) {
        // Data is stored as [x0, y0, x1, y1, ...]
        const px = data[j * 2];
        const py = data[j * 2 + 1];

        // Normalize to relative coordinates (0.0 - 1.0)
        points.push({
          x: px / width,
          y: py / height,
        });
      }

      if (points.length > 0) {
        polylines.push(points);
      }
    }

    // 6. Return Data
    postMessage({
      msg,
      payload: {
        polylines, // Array of Array of {x,y}
        bounds: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      },
    });
  } catch (err) {
    let errorMessage = err;
    if (typeof err === "number") {
      try {
        errorMessage = cv.exceptionFromPtr(err).msg;
      } catch (e) {
        errorMessage = `Unknown C++ Exception: ${err}`;
      }
    } else if (err?.message) {
      errorMessage = err.message;
    }
    console.error(
      "[opencv worker] getHorizontalAndVerticalLinesAsync failed",
      errorMessage
    );
    postMessage({ msg, error: errorMessage });
  } finally {
    if (typeof matList !== "undefined") {
      matList.forEach((m) => m && !m.isDeleted() && m.delete());
    }
  }
}
