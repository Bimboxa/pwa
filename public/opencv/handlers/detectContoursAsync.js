async function detectContoursAsync({ msg, payload }) {
  const matList = [];
  const track = (mat) => { if (mat) matList.push(mat); return mat; };

  try {
    const {
      imageUrl,
      x,
      y,
      colorTolerance = 15,
      morphKernelSize = 3,
      morphIterations = 2,
      floodWindowSize = 256,
      viewportBBox,
      boundaries,
      exclusionMaskBuffer = null,
      maskWidth = 0,
      maskHeight = 0,
      skipApproxPoly = false,
      ignoreBaseMap = false,
    } = payload ?? {};

    // White page base map: no pixels to read (and no decodable image) — the
    // caller sends ignoreBaseMap without imageUrl, the image size is the
    // exclusion mask size.
    const hasNoImage =
      !imageUrl && ignoreBaseMap && maskWidth > 0 && maskHeight > 0;

    if ((!imageUrl && !hasNoImage) || x === undefined || y === undefined) {
      throw new Error("imageUrl, x, and y are required");
    }

    let src = null;
    let imageWidth = maskWidth;
    let imageHeight = maskHeight;
    if (!hasNoImage) {
      const imageData = await loadImageDataFromUrl(imageUrl);
      src = track(cv.matFromImageData(imageData));
      imageWidth = src.cols;
      imageHeight = src.rows;
    }

    let pixelX = x >= 0 && x <= 1 ? Math.floor(x * imageWidth) : Math.floor(x);
    let pixelY = y >= 0 && y <= 1 ? Math.floor(y * imageHeight) : Math.floor(y);

    if (pixelX < 0 || pixelX >= imageWidth || pixelY < 0 || pixelY >= imageHeight) {
      throw new Error(`Coordinates out of bounds`);
    }

    // --- 1. ROI (visible viewport, clamped to the image) ---
    // Computed first: every following step works on the ROI only, in ROI
    // coordinates, so a large photo is never processed at full size.
    let roiX = Math.max(0, pixelX - Math.floor(floodWindowSize / 2));
    let roiY = Math.max(0, pixelY - Math.floor(floodWindowSize / 2));

    if (viewportBBox && Number.isFinite(viewportBBox.x)) {
      roiX = Math.max(0, Math.min(imageWidth - 1, Math.floor(viewportBBox.x)));
      roiY = Math.max(0, Math.min(imageHeight - 1, Math.floor(viewportBBox.y)));
    }

    const roiWidth = Math.max(
      1,
      Math.floor(Math.min(imageWidth - roiX, viewportBBox?.width || floodWindowSize))
    );
    const roiHeight = Math.max(
      1,
      Math.floor(Math.min(imageHeight - roiY, viewportBBox?.height || floodWindowSize))
    );

    const seedX = pixelX - roiX;
    const seedY = pixelY - roiY;
    if (seedX < 0 || seedX >= roiWidth || seedY < 0 || seedY >= roiHeight) {
      throw new Error("Click outside the visible area");
    }

    const roiRect = new cv.Rect(roiX, roiY, roiWidth, roiHeight);

    let processedBinary;

    if (ignoreBaseMap) {
      // --- "Ignorer le fond de plan" — skip the colour/morph pipeline and run
      // on an all-white binary. The fill then propagates over the whole ROI
      // and is bounded only by the exclusion mask (existing annotation
      // footprints) and the ROI/viewport.
      if (src) src.delete(); // free RGBA mat early — image content is not used
      processedBinary = track(
        new cv.Mat(roiHeight, roiWidth, cv.CV_8UC1, new cv.Scalar(255))
      );
    } else {
      // --- 2. CROP TO THE ROI, DROP ALPHA ---
      const srcRoi = track(src.roi(roiRect));
      const rgb = track(new cv.Mat());
      cv.cvtColor(srcRoi, rgb, cv.COLOR_RGBA2RGB);
      srcRoi.delete();
      src.delete(); // free the full-size RGBA mat early

      // --- 3. DENOISE ---
      // Median blur removes grain / JPEG noise (photos) while keeping edges,
      // so the clicked pixel is a stable colour reference.
      const blurred = track(new cv.Mat());
      cv.medianBlur(rgb, blurred, 5);
      rgb.delete();

      // --- 4. COLOUR MASK: pixels close to the clicked colour ---
      // Per-channel RGB distance to the colour under the click.
      const seedColor = blurred.ucharPtr(seedY, seedX);
      const tolerance = Math.max(0, Number(colorTolerance) || 0);
      const low = [0, 1, 2].map((c) => Math.max(0, seedColor[c] - tolerance));
      const high = [0, 1, 2].map((c) => Math.min(255, seedColor[c] + tolerance));

      // inRange needs Mats of the same size and type as the source (the
      // Scalar overload raises a BindingError in opencv.js).
      const lowMat = track(
        new cv.Mat(roiHeight, roiWidth, cv.CV_8UC3, new cv.Scalar(low[0], low[1], low[2]))
      );
      const highMat = track(
        new cv.Mat(roiHeight, roiWidth, cv.CV_8UC3, new cv.Scalar(high[0], high[1], high[2]))
      );
      const binary = track(new cv.Mat());
      cv.inRange(blurred, lowMat, highMat, binary);
      blurred.delete();
      lowMat.delete();
      highMat.delete();

      // --- 5. MORPHOLOGY (opening of the matching area) ---
      const inverted = track(new cv.Mat());
      cv.bitwise_not(binary, inverted);
      binary.delete();

      const kernelSize = Math.max(3, morphKernelSize | 0);
      const kernel = track(cv.Mat.ones(kernelSize, kernelSize, cv.CV_8U));
      const closedInverted = track(new cv.Mat());
      cv.morphologyEx(
        inverted,
        closedInverted,
        cv.MORPH_CLOSE,
        kernel,
        new cv.Point(-1, -1),
        Math.max(1, morphIterations | 0)
      );
      inverted.delete();

      processedBinary = track(new cv.Mat());
      cv.bitwise_not(closedInverted, processedBinary);
      closedInverted.delete();
    }

    // --- 5b. DRAW EXISTING ANNOTATION BOUNDARIES AS BARRIERS ---
    if (boundaries?.length) {
      // Boundaries come in image pixels — shift them to ROI coordinates.
      const shift = (pts) =>
        pts?.map((p) => ({ x: p.x - roiX, y: p.y - roiY }));
      const roiBoundaries = boundaries.map((boundary) => ({
        ...boundary,
        points: shift(boundary.points),
        cuts: boundary.cuts?.map((cut) => ({ ...cut, points: shift(cut.points) })),
      }));
      drawBoundariesOnBinary(processedBinary, roiBoundaries, track);
    }

    // --- 5c. APPLY EXCLUSION MASK (footprint of all visible annotations) ---
    // The mask is a full-image Uint8Array (1 = pixel covered by an existing
    // annotation) built on the main thread via buildExclusionMask — same
    // rasterizer used by smartDetect. Masked pixels are forced to 0 (black)
    // so the flood fill cannot propagate through any annotation footprint
    // (STRIP, open/closed POLYLINE, POLYGON, POINT).
    if (exclusionMaskBuffer && maskWidth === imageWidth && maskHeight === imageHeight) {
      const exclusion = new Uint8Array(exclusionMaskBuffer);
      const bin = processedBinary.data;
      for (let ry = 0; ry < roiHeight; ry++) {
        const maskRow = (ry + roiY) * maskWidth + roiX;
        const binRow = ry * roiWidth;
        for (let rx = 0; rx < roiWidth; rx++) {
          if (exclusion[maskRow + rx]) bin[binRow + rx] = 0;
        }
      }
    }

    // The clicked pixel must belong to the fillable area: otherwise floodFill
    // would propagate over the NON-matching area (inverted result). Happens
    // when the click is on an annotation footprint or on a feature thinner
    // than the morphological opening.
    if (processedBinary.ucharPtr(seedY, seedX)[0] === 0) {
      throw new Error("No area found at the click point");
    }

    // --- 6. FLOODFILL ---
    const mask = track(new cv.Mat.zeros(roiHeight + 2, roiWidth + 2, cv.CV_8UC1));
    const seedPoint = new cv.Point(seedX, seedY);

    cv.floodFill(
      processedBinary,
      mask,
      seedPoint,
      new cv.Scalar(255),
      new cv.Rect(),
      new cv.Scalar(0),
      new cv.Scalar(0),
      4 | (255 << 8) | cv.FLOODFILL_MASK_ONLY
    );

    const maskRoi = track(mask.roi(new cv.Rect(1, 1, roiWidth, roiHeight)));

    // --- 7. EXTRACTION DES CONTOURS ---
    const contours = track(new cv.MatVector());
    const hierarchy = track(new cv.Mat());
    cv.findContours(maskRoi, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    // --- 8. PARCOURS ---
    const EPSILON_PX = Math.max(1, Math.min(roiWidth, roiHeight) * 0.0025);
    const contourPoints = [];
    const contourAreas = [];

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      const peri = cv.arcLength(cnt, true);

      if (peri > 5) {
        let pts;
        if (skipApproxPoly) {
          pts = [];
          for (let j = 0; j < cnt.rows; j++) {
            pts.push({
              x: cnt.data32S[j * 2] + roiX + 0.5,
              y: cnt.data32S[j * 2 + 1] + roiY + 0.5,
            });
          }
        } else {
          const approx = track(new cv.Mat());
          cv.approxPolyDP(cnt, approx, EPSILON_PX, true);
          pts = [];
          for (let j = 0; j < approx.rows; j++) {
            pts.push({
              x: approx.data32S[j * 2] + roiX + 0.5,
              y: approx.data32S[j * 2 + 1] + roiY + 0.5,
            });
          }
        }
        contourPoints[i] = pts;
        contourAreas[i] = Math.abs(area);
      } else {
        contourPoints[i] = null;
        contourAreas[i] = 0;
      }
      cnt.delete();
    }

    let mainIdx = -1;
    let maxArea = 0;
    const hierData = hierarchy.data32S;

    for (let i = 0; i < contours.size(); i++) {
      if (hierData[i * 4 + 3] === -1 && contourAreas[i] > maxArea) {
        maxArea = contourAreas[i];
        mainIdx = i;
      }
    }

    if (mainIdx === -1 || !contourPoints[mainIdx]) {
      throw new Error("No valid contour found");
    }

    const cuts = [];
    let childIdx = hierData[mainIdx * 4 + 2];
    while (childIdx !== -1) {
      if (contourPoints[childIdx]) {
        cuts.push({ id: `cut-${childIdx}`, points: contourPoints[childIdx], closeLine: true });
      }
      childIdx = hierData[childIdx * 4];
    }

    postMessage({
      msg,
      payload: { points: contourPoints[mainIdx], cuts: cuts.length > 0 ? cuts : undefined }
    });

  } catch (error) {
    console.error("[opencv worker] failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  } finally {
    matList.forEach(m => m && !m.isDeleted() && m.delete());
  }
}