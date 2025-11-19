async function getPixelColorAsync({ msg, payload }) {
  try {
    const { imageUrl, x, y, tolerance = 20 } = payload;

    if (!imageUrl || x === undefined || y === undefined) {
      throw new Error("imageUrl, x, and y are required");
    }

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = cv.matFromImageData(imageData);

    // Get image dimensions for normalizing coordinates
    const imageWidth = src.cols;
    const imageHeight = src.rows;

    // Convert coordinates to integers if needed (in case they're normalized 0-1)
    let pixelX, pixelY;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      // Normalized coordinates (0-1 range)
      pixelX = Math.floor(x * imageWidth);
      pixelY = Math.floor(y * imageHeight);
    } else {
      // Pixel coordinates
      pixelX = Math.floor(x);
      pixelY = Math.floor(y);
    }

    // Validate coordinates
    if (
      pixelX < 0 ||
      pixelX >= imageWidth ||
      pixelY < 0 ||
      pixelY >= imageHeight
    ) {
      src.delete();
      throw new Error(
        `Coordinates (${pixelX}, ${pixelY}) are out of bounds for image size (${imageWidth}, ${imageHeight})`
      );
    }

    // Access pixel data using ucharPtr (OpenCV.js method)
    // Format: [B, G, R, A] for CV_8UC4
    const pixelPtr = src.ucharPtr(pixelY, pixelX);
    const seedColor = {
      r: pixelPtr[2], // Red channel
      g: pixelPtr[1], // Green channel
      b: pixelPtr[0], // Blue channel
      a: pixelPtr[3], // Alpha channel
    };

    // Convert to HSV for better color matching
    const hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

    // Get the seed pixel color in HSV
    const seedPtr = hsv.ucharPtr(pixelY, pixelX);
    const seedH = seedPtr[0];
    const seedS = seedPtr[1];
    const seedV = seedPtr[2];

    // Create a mask to store the flood-filled region
    const mask = new cv.Mat();
    mask.create(src.rows + 2, src.cols + 2, cv.CV_8UC1);
    mask.setTo(new cv.Scalar(0, 0, 0, 0));

    // Define the tolerance for color matching in HSV
    const loDiff = new cv.Scalar(tolerance, tolerance, tolerance, 0);
    const upDiff = new cv.Scalar(tolerance, tolerance, tolerance, 0);

    // Create a seed point
    // Note: when using floodFill with mask, the mask has 2px border, so seed point uses image coordinates
    const seedPoint = new cv.Point(pixelX, pixelY);

    // Create a rect object for the bounding rectangle (required by OpenCV.js, even if not used)
    const rect = new cv.Rect(0, 0, 0, 0);

    // Perform flood fill to find all connected pixels with similar color
    // Using FLOODFILL_FIXED_RANGE to match within tolerance from seed color
    cv.floodFill(
      hsv,
      mask,
      seedPoint,
      new cv.Scalar(255, 255, 255, 0),
      rect,
      loDiff,
      upDiff,
      cv.FLOODFILL_FIXED_RANGE
    );

    // Remove the border padding from mask (floodFill adds 1px border)
    const maskRoi = mask.roi(new cv.Rect(1, 1, imageWidth, imageHeight));

    // Find contours around the region
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      maskRoi,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    const MIN_PERIMETER_PX = 5; // Ignore tiny contours

    // Convert contours to polylines with normalized coordinates (0-1 range)
    const polylines = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const perimeter = cv.arcLength(contour, true);

      // Skip very small contours or invalid results
      if (!Number.isFinite(perimeter) || perimeter < MIN_PERIMETER_PX) {
        contour.delete();
        continue;
      }

      const EPSILON_PX = 5; // fixed smoothing distance in pixels
      const epsilon = Math.max(EPSILON_PX, 1);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, epsilon, true);

      const pointsMat = approx.rows > 0 ? approx : contour;
      const points = [];
      for (let j = 0; j < pointsMat.rows; j++) {
        // Convert pixel coordinates to normalized coordinates (0-1 range)
        // 0,0 is top-left, 1,1 is bottom-right
        const pixelX = pointsMat.data32S[j * 2];
        const pixelY = pointsMat.data32S[j * 2 + 1];
        points.push({
          x: pixelX / imageWidth,
          y: pixelY / imageHeight,
        });
      }
      if (points.length > 0) {
        polylines.push(points);
      }

      approx.delete();
      contour.delete();
    }

    // Cleanup
    src.delete();
    hsv.delete();
    mask.delete();
    maskRoi.delete();
    contours.delete();
    hierarchy.delete();

    postMessage({
      msg,
      payload: {
        color: seedColor,
        polylines: polylines,
      },
    });
  } catch (error) {
    console.error("[opencv worker] getPixelColorAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}
