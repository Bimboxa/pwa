async function handleGetPixelsCountByColorAsync(event) {
  const { msg, payload } = event;
  try {
    if (!payload || !payload.imageUrl) {
      throw new Error("imageUrl is required");
    }

    const { imageUrl, colorName, customColorRanges } = payload;
    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = cv.matFromImageData(imageData);
    const hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

    // Get image dimensions for normalizing coordinates
    const imageWidth = src.cols;
    const imageHeight = src.rows;

    const ranges = buildColorRanges(colorName, customColorRanges);
    const results = {};

    ranges.forEach((range) => {
      const mask = new cv.Mat();
      // Ensure values are numbers
      const lowerVals = [
        Number(range.lower[0]),
        Number(range.lower[1]),
        Number(range.lower[2]),
      ];
      const upperVals = [
        Number(range.upper[0]),
        Number(range.upper[1]),
        Number(range.upper[2]),
      ];

      // OpenCV.js inRange requires Mat objects for bounds
      // Create 1x1 Mats with scalar values (they will be broadcast automatically)
      const lowerScalar = new cv.Scalar(
        lowerVals[0],
        lowerVals[1],
        lowerVals[2],
        0
      );
      const upperScalar = new cv.Scalar(
        upperVals[0],
        upperVals[1],
        upperVals[2],
        0
      );

      const lowerBound = new cv.Mat(1, 1, cv.CV_8UC3, lowerScalar);
      const upperBound = new cv.Mat(1, 1, cv.CV_8UC3, upperScalar);

      cv.inRange(hsv, lowerBound, upperBound, mask);

      // Cleanup
      lowerBound.delete();
      upperBound.delete();

      const count = cv.countNonZero(mask);
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(
        mask,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );

      const contoursArray = [];
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const points = [];
        for (let j = 0; j < contour.rows; j++) {
          // Convert pixel coordinates to normalized coordinates (0-1 range)
          // 0,0 is top-left, 1,1 is bottom-right
          const pixelX = contour.data32S[j * 2];
          const pixelY = contour.data32S[j * 2 + 1];
          points.push({
            x: pixelX / imageWidth,
            y: pixelY / imageHeight,
          });
        }
        contoursArray.push(points);
      }

      if (!results[range.key]) {
        results[range.key] = { pixelCount: 0, contours: [] };
      }
      results[range.key].pixelCount += count;
      results[range.key].contours.push(...contoursArray);

      mask.delete();
      contours.delete();
      hierarchy.delete();
    });

    src.delete();
    hsv.delete();

    postMessage({ msg, payload: results });
  } catch (error) {
    console.error("[opencv worker] getPixelsCountByColorAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}
