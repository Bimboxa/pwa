async function detectContoursAsync({ msg, payload }) {
  try {
    const {
      imageUrl,
      x,
      y,
      whiteThreshold = 215,
      morphKernelSize = 3,
      morphIterations = 2,
      floodWindowSize = 256,
      viewportBBox,
    } = payload ?? {};

    if (!imageUrl || x === undefined || y === undefined) {
      throw new Error("imageUrl, x, and y are required");
    }

    console.log("detectContoursAsync x,y", x, y);

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = cv.matFromImageData(imageData);

    const imageWidth = src.cols;
    const imageHeight = src.rows;

    let pixelX, pixelY;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      pixelX = Math.floor(x * imageWidth);
      pixelY = Math.floor(y * imageHeight);
    } else {
      pixelX = Math.floor(x);
      pixelY = Math.floor(y);
    }

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

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const binary = new cv.Mat();
    cv.threshold(gray, binary, whiteThreshold, 255, cv.THRESH_BINARY);

    const inverted = new cv.Mat();
    cv.bitwise_not(binary, inverted);

    const kernelSize = Math.max(3, morphKernelSize | 0);
    const kernel = cv.Mat.ones(kernelSize, kernelSize, cv.CV_8U);
    const closedInverted = new cv.Mat();
    cv.morphologyEx(
      inverted,
      closedInverted,
      cv.MORPH_CLOSE,
      kernel,
      new cv.Point(-1, -1),
      Math.max(1, morphIterations | 0)
    );

    const processedBinary = new cv.Mat();
    cv.bitwise_not(closedInverted, processedBinary);

    const halfWindow = Math.max(32, Math.floor(floodWindowSize / 2));
    let roiX = Math.max(0, pixelX - halfWindow);
    let roiY = Math.max(0, pixelY - halfWindow);
    let roiWidth = Math.min(floodWindowSize, imageWidth - roiX);
    let roiHeight = Math.min(floodWindowSize, imageHeight - roiY);

    if (
      viewportBBox &&
      Number.isFinite(viewportBBox.x) &&
      Number.isFinite(viewportBBox.y) &&
      Number.isFinite(viewportBBox.width) &&
      Number.isFinite(viewportBBox.height)
    ) {
      const bboxX = Math.floor(viewportBBox.x);
      const bboxY = Math.floor(viewportBBox.y);
      const bboxWidth = Math.max(1, Math.floor(viewportBBox.width));
      const bboxHeight = Math.max(1, Math.floor(viewportBBox.height));

      roiX = Math.max(0, Math.min(imageWidth - 1, bboxX));
      roiY = Math.max(0, Math.min(imageHeight - 1, bboxY));
      roiWidth = Math.min(imageWidth - roiX, bboxWidth);
      roiHeight = Math.min(imageHeight - roiY, bboxHeight);

      // Ensure the ROI still contains the selected pixel
      if (pixelX < roiX) {
        const shift = roiX - pixelX;
        roiX = Math.max(0, roiX - shift);
        roiWidth = Math.min(imageWidth - roiX, roiWidth + shift);
      } else if (pixelX >= roiX + roiWidth) {
        const shift = pixelX - (roiX + roiWidth) + 1;
        roiWidth = Math.min(imageWidth - roiX, roiWidth + shift);
      }

      if (pixelY < roiY) {
        const shift = roiY - pixelY;
        roiY = Math.max(0, roiY - shift);
        roiHeight = Math.min(imageHeight - roiY, roiHeight + shift);
      } else if (pixelY >= roiY + roiHeight) {
        const shift = pixelY - (roiY + roiHeight) + 1;
        roiHeight = Math.min(imageHeight - roiY, roiHeight + shift);
      }
    }

    roiWidth = Math.max(1, roiWidth);
    roiHeight = Math.max(1, roiHeight);

    const roiRect = new cv.Rect(roiX, roiY, roiWidth, roiHeight);
    const roiMat = processedBinary.roi(roiRect);

    const seedValue = roiMat.ucharPtr(pixelY - roiY, pixelX - roiX)[0];
    if (seedValue < 128) {
      src.delete();
      gray.delete();
      binary.delete();
      inverted.delete();
      kernel.delete();
      closedInverted.delete();
      processedBinary.delete();
      roiMat.delete();
      throw new Error("Seed point is not inside a white region.");
    }

    const mask = new cv.Mat();
    mask.create(roiHeight + 2, roiWidth + 2, cv.CV_8UC1);
    mask.setTo(new cv.Scalar(0, 0, 0, 0));

    const seedPoint = new cv.Point(pixelX - roiX, pixelY - roiY);
    const rect = new cv.Rect(0, 0, 0, 0);
    const loDiff = new cv.Scalar(0);
    const upDiff = new cv.Scalar(0);
    const connectivity = 4;
    const newMaskVal = 255;
    const floodFlags =
      connectivity |
      (newMaskVal << 8) |
      cv.FLOODFILL_MASK_ONLY |
      cv.FLOODFILL_FIXED_RANGE;

    cv.floodFill(
      roiMat,
      mask,
      seedPoint,
      new cv.Scalar(255),
      rect,
      loDiff,
      upDiff,
      floodFlags
    );

    const maskRoi = mask.roi(new cv.Rect(1, 1, roiWidth, roiHeight));

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      maskRoi,
      contours,
      hierarchy,
      cv.RETR_CCOMP,
      cv.CHAIN_APPROX_SIMPLE
    );

    const MIN_PERIMETER_PX = 5;
    const EPSILON_PX = Math.max(1, Math.min(roiWidth, roiHeight) * 0.0025);

    const contourPoints = new Array(contours.size()).fill(null);
    const contourAreas = new Array(contours.size()).fill(0);

    function extractPoints(idx) {
      if (contourPoints[idx]) return contourPoints[idx];

      const contour = contours.get(idx);
      const perimeter = cv.arcLength(contour, true);
      if (!Number.isFinite(perimeter) || perimeter < MIN_PERIMETER_PX) {
        contour.delete();
        contourPoints[idx] = null;
        contourAreas[idx] = 0;
        return null;
      }

      // Calculate area for sorting
      const area = Math.abs(cv.contourArea(contour));
      contourAreas[idx] = area;

      const approx = new cv.Mat();
      const epsilon = Math.max(EPSILON_PX, 1);
      cv.approxPolyDP(contour, approx, epsilon, true);
      const useApprox = approx.rows > 0 && approx.rows <= contour.rows * 2;
      const pointsMat = useApprox ? approx : contour;
      const points = [];
      for (let j = 0; j < pointsMat.rows; j++) {
        const contourX = pointsMat.data32S[j * 2] + roiX;
        const contourY = pointsMat.data32S[j * 2 + 1] + roiY;
        // points.push({
        //   x: contourX / imageWidth,
        //   y: contourY / imageHeight,
        // });
        points.push({
          x: contourX,
          y: contourY,
        });
      }

      approx.delete();
      contour.delete();

      contourPoints[idx] = points.length ? points : null;
      return contourPoints[idx];
    }

    // Extract all contour points
    for (let i = 0; i < contours.size(); i++) {
      extractPoints(i);
    }

    // Find the largest outer contour (main contour)
    let mainContourIdx = -1;
    let maxArea = 0;

    if (hierarchy.data32S && hierarchy.data32S.length >= contours.size() * 4) {
      const hierData = hierarchy.data32S;
      for (let i = 0; i < contours.size(); i++) {
        const parentIdx = hierData[i * 4 + 3];
        // Outer contour has no parent (parentIdx === -1)
        if (parentIdx === -1 && contourAreas[i] > maxArea) {
          maxArea = contourAreas[i];
          mainContourIdx = i;
        }
      }
    }

    if (mainContourIdx === -1 || !contourPoints[mainContourIdx]) {
      src.delete();
      gray.delete();
      binary.delete();
      kernel.delete();
      inverted.delete();
      closedInverted.delete();
      processedBinary.delete();
      roiMat.delete();
      mask.delete();
      maskRoi.delete();
      contours.delete();
      hierarchy.delete();
      throw new Error("No valid outer contour found");
    }

    // Get main contour points
    const mainPoints = contourPoints[mainContourIdx];

    // Find all inner contours (holes) inside the main contour
    const cuts = [];
    if (hierarchy.data32S && hierarchy.data32S.length >= contours.size() * 4) {
      const hierData = hierarchy.data32S;
      // The main contour's children are the holes
      let childIdx = hierData[mainContourIdx * 4 + 2];
      while (childIdx !== -1) {
        const holePoints = contourPoints[childIdx];
        if (holePoints && holePoints.length >= 2) {
          cuts.push({
            id: `cut-${childIdx}`,
            points: holePoints,
            closeLine: true,
          });
        }
        // Move to next sibling hole
        childIdx = hierData[childIdx * 4 + 0];
      }
    }

    src.delete();
    gray.delete();
    binary.delete();
    kernel.delete();
    inverted.delete();
    closedInverted.delete();
    processedBinary.delete();
    roiMat.delete();
    mask.delete();
    maskRoi.delete();
    contours.delete();
    hierarchy.delete();

    // Return polyline structure with main contour and cuts
    postMessage({
      msg,
      payload: {
        points: mainPoints,
        cuts: cuts.length > 0 ? cuts : undefined,
      },
    });
  } catch (error) {
    console.error("[opencv worker] detectContoursAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}

