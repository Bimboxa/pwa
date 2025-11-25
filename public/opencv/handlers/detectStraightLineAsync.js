async function detectStraightLineAsync({ msg, payload }) {
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

    console.log("detectStraightLineAsync x,y", x, y);

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

    // Determine ROI based on viewport or default window
    let roiX, roiY, roiWidth, roiHeight;
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
    } else {
      const halfWindow = Math.max(32, Math.floor(floodWindowSize / 2));
      roiX = Math.max(0, pixelX - halfWindow);
      roiY = Math.max(0, pixelY - halfWindow);
      roiWidth = Math.min(floodWindowSize, imageWidth - roiX);
      roiHeight = Math.min(floodWindowSize, imageHeight - roiY);
    }

    // Ensure ROI contains the clicked pixel
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

    roiWidth = Math.max(1, roiWidth);
    roiHeight = Math.max(1, roiHeight);

    const roiRect = new cv.Rect(roiX, roiY, roiWidth, roiHeight);
    const roiMat = processedBinary.roi(roiRect);

    let floodSource = roiMat;
    let floodSourceNeedsDelete = false;
    let seedValue = floodSource.ucharPtr(pixelY - roiY, pixelX - roiX)[0];

    if (seedValue < 128) {
      const invertedFlood = new cv.Mat();
      cv.bitwise_not(roiMat, invertedFlood);
      const invertedSeedValue = invertedFlood.ucharPtr(
        pixelY - roiY,
        pixelX - roiX
      )[0];

      if (invertedSeedValue >= 128) {
        floodSource = invertedFlood;
        floodSourceNeedsDelete = true;
        seedValue = invertedSeedValue;
      } else {
        invertedFlood.delete();

        src.delete();
        gray.delete();
        binary.delete();
        inverted.delete();
        kernel.delete();
        closedInverted.delete();
        processedBinary.delete();
        roiMat.delete();
        throw new Error("Seed point is not inside a detectable region.");
      }
    }

    // Flood fill to get the region
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
      floodSource,
      mask,
      seedPoint,
      new cv.Scalar(255),
      rect,
      loDiff,
      upDiff,
      floodFlags
    );

    const maskRoi = mask.roi(new cv.Rect(1, 1, roiWidth, roiHeight));

    // Use HoughLines to detect straight lines in the flooded region
    const lines = new cv.Mat();
    cv.HoughLinesP(
      maskRoi,
      lines,
      1, // rho resolution (pixels)
      Math.PI / 180, // theta resolution (radians)
      50, // threshold (minimum votes)
      50, // minLineLength (pixels)
      10 // maxLineGap (pixels)
    );

    let bestLine = null;
    let minDistance = Infinity;
    const clickedPoint = { x: pixelX, y: pixelY };

    // Find the line closest to the clicked point
    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4];
      const y1 = lines.data32S[i * 4 + 1];
      const x2 = lines.data32S[i * 4 + 2];
      const y2 = lines.data32S[i * 4 + 3];

      // Convert to absolute coordinates
      const absX1 = x1 + roiX;
      const absY1 = y1 + roiY;
      const absX2 = x2 + roiX;
      const absY2 = y2 + roiY;

      // Calculate distance from clicked point to line segment
      const A = clickedPoint.x - absX1;
      const B = clickedPoint.y - absY1;
      const C = absX2 - absX1;
      const D = absY2 - absY1;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;

      let xx, yy;
      if (param < 0) {
        xx = absX1;
        yy = absY1;
      } else if (param > 1) {
        xx = absX2;
        yy = absY2;
      } else {
        xx = absX1 + param * C;
        yy = absY1 + param * D;
      }

      const dx = clickedPoint.x - xx;
      const dy = clickedPoint.y - yy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        bestLine = {
          x1: absX1 / imageWidth,
          y1: absY1 / imageHeight,
          x2: absX2 / imageWidth,
          y2: absY2 / imageHeight,
        };
      }
    }

    // If no line found, try to fit a line through the flooded region
    if (!bestLine && maskRoi) {
      // Get all points in the flooded region
      const points = [];
      for (let py = 0; py < maskRoi.rows; py++) {
        for (let px = 0; px < maskRoi.cols; px++) {
          if (maskRoi.ucharPtr(py, px)[0] > 128) {
            points.push({
              x: (px + roiX) / imageWidth,
              y: (py + roiY) / imageHeight,
            });
          }
        }
      }

      if (points.length >= 2) {
        // Use least squares to fit a line
        let sumX = 0,
          sumY = 0,
          sumXY = 0,
          sumXX = 0;
        for (const p of points) {
          const px = p.x * imageWidth;
          const py = p.y * imageHeight;
          sumX += px;
          sumY += py;
          sumXY += px * py;
          sumXX += px * px;
        }
        const n = points.length;
        const denominator = n * sumXX - sumX * sumX;
        if (Math.abs(denominator) > 1e-6) {
          const slope = (n * sumXY - sumX * sumY) / denominator;
          const intercept = (sumY - slope * sumX) / n;

          // Create line endpoints that span the ROI
          const minX = roiX;
          const maxX = roiX + roiWidth;
          const y1 = (slope * minX + intercept) / imageHeight;
          const y2 = (slope * maxX + intercept) / imageHeight;

          bestLine = {
            x1: minX / imageWidth,
            y1: y1,
            x2: maxX / imageWidth,
            y2: y2,
          };
        }
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
    lines.delete();
    if (floodSourceNeedsDelete && floodSource && floodSource !== roiMat) {
      floodSource.delete();
    }

    if (!bestLine) {
      postMessage({
        msg,
        payload: {
          line: null,
          angle: null,
        },
      });
      return;
    }

    // Calculate angle in degrees
    const dx = bestLine.x2 - bestLine.x1;
    const dy = bestLine.y2 - bestLine.y1;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    postMessage({
      msg,
      payload: {
        line: bestLine,
        angle: angleDeg,
      },
    });
  } catch (error) {
    console.error("[opencv worker] detectStraightLineAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}
