async function getWhiteContoursAsync({ msg, payload }) {
  try {
    const {
      imageUrl,
      x,
      y,
      whiteThreshold = 215,
      morphKernelSize = 3,
      morphIterations = 2,
      floodWindowSize = 256,
    } = payload ?? {};

    if (!imageUrl || x === undefined || y === undefined) {
      throw new Error("imageUrl, x, and y are required");
    }

    console.log("getWhiteContoursAsync x,y", x, y);

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
    const roiX = Math.max(0, pixelX - halfWindow);
    const roiY = Math.max(0, pixelY - halfWindow);
    const roiWidth = Math.min(floodWindowSize, imageWidth - roiX);
    const roiHeight = Math.min(floodWindowSize, imageHeight - roiY);
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

    // Convert processed binary ROI to image blob for display (before flood fill)
    let maskImageBlob = null;
    try {
      // Create a 3-channel image from the binary ROI (grayscale to RGB)
      const roiRgb = new cv.Mat();
      cv.cvtColor(roiMat, roiRgb, cv.COLOR_GRAY2RGB);

      // Convert to ImageData
      const roiImageData = imageDataFromMat(roiRgb);

      // Convert ImageData to blob
      const canvas = new OffscreenCanvas(
        roiImageData.width,
        roiImageData.height
      );
      const ctx = canvas.getContext("2d");
      ctx.putImageData(roiImageData, 0, 0);

      maskImageBlob = await canvas.convertToBlob({ type: "image/png" });

      roiRgb.delete();
    } catch (error) {
      console.error(
        "[getWhiteContoursAsync] Failed to create mask image:",
        error
      );
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

    const polylines = [];
    const polygons = [];
    const MIN_PERIMETER_PX = 5;
    const EPSILON_PX = Math.max(1, Math.min(roiWidth, roiHeight) * 0.0025);

    const contourPoints = new Array(contours.size()).fill(null);

    function extractPoints(idx) {
      if (contourPoints[idx]) return contourPoints[idx];

      const contour = contours.get(idx);
      const perimeter = cv.arcLength(contour, true);
      if (!Number.isFinite(perimeter) || perimeter < MIN_PERIMETER_PX) {
        contour.delete();
        contourPoints[idx] = null;
        return null;
      }

      const approx = new cv.Mat();
      const epsilon = Math.max(EPSILON_PX, 1);
      cv.approxPolyDP(contour, approx, epsilon, true);
      const useApprox = approx.rows > 0 && approx.rows <= contour.rows * 2;
      const pointsMat = useApprox ? approx : contour;
      const points = [];
      for (let j = 0; j < pointsMat.rows; j++) {
        const contourX = pointsMat.data32S[j * 2] + roiX;
        const contourY = pointsMat.data32S[j * 2 + 1] + roiY;
        points.push({
          x: contourX / imageWidth,
          y: contourY / imageHeight,
        });
      }

      approx.delete();
      contour.delete();

      contourPoints[idx] = points.length ? points : null;
      return contourPoints[idx];
    }

    for (let i = 0; i < contours.size(); i++) {
      const points = extractPoints(i);
      if (points) polylines.push(points);
    }

    if (hierarchy.data32S && hierarchy.data32S.length >= contours.size() * 4) {
      const hierData = hierarchy.data32S;
      for (let i = 0; i < contours.size(); i++) {
        const parentIdx = hierData[i * 4 + 3];
        if (parentIdx !== -1) continue;

        const outer = contourPoints[i];
        if (!outer) continue;

        const holes = [];
        let childIdx = hierData[i * 4 + 2];
        while (childIdx !== -1) {
          const holePoints = contourPoints[childIdx];
          if (holePoints) holes.push(holePoints);
          childIdx = hierData[childIdx * 4 + 0];
        }

        polygons.push({ outer, holes });
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

    // Convert blob to base64 for transfer (workers can't transfer blobs directly)
    let maskImageBase64 = null;
    if (maskImageBlob) {
      const arrayBuffer = await maskImageBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = String.fromCharCode.apply(null, uint8Array);
      maskImageBase64 = btoa(binaryString);
    }

    postMessage({
      msg,
      payload: {
        polylines,
        polygons,
        maskImageBase64, // Base64 encoded PNG
      },
    });
  } catch (error) {
    console.error("[opencv worker] getWhiteContoursAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}
