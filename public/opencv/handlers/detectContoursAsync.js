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
    } = payload ?? {};

    if (!imageUrl || x === undefined || y === undefined) {
      throw new Error("imageUrl, x, and y are required");
    }

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = track(cv.matFromImageData(imageData));

    const imageWidth = src.cols;
    const imageHeight = src.rows;

    let pixelX = x >= 0 && x <= 1 ? Math.floor(x * imageWidth) : Math.floor(x);
    let pixelY = y >= 0 && y <= 1 ? Math.floor(y * imageHeight) : Math.floor(y);

    if (pixelX < 0 || pixelX >= imageWidth || pixelY < 0 || pixelY >= imageHeight) {
      throw new Error(`Coordinates out of bounds`);
    }

    // --- 1. PASSAGE EN GRIS ---
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // --- 2. RÉCUPÉRATION DE LA VALEUR CIBLE ---
    const targetGray = gray.ucharPtr(pixelY, pixelX)[0];

    // --- 3. CRÉATION DU MASQUE BINAIRE (Correction définitive BindingError) ---
    const binary = track(new cv.Mat());
    const lowVal = Math.max(0, targetGray - colorTolerance);
    const highVal = Math.min(255, targetGray + colorTolerance);

    // On crée des Mats de la même taille et du même type (CV_8UC1) que 'gray'
    // C'est la méthode la plus lourde mais la seule qui garantit 0 erreur de binding
    const lowMat = track(new cv.Mat(gray.rows, gray.cols, gray.type(), new cv.Scalar(lowVal)));
    const highMat = track(new cv.Mat(gray.rows, gray.cols, gray.type(), new cv.Scalar(highVal)));

    cv.inRange(gray, lowMat, highMat, binary);

    // --- 4. TRAITEMENT MORPHOLOGIQUE ---
    const inverted = track(new cv.Mat());
    cv.bitwise_not(binary, inverted);

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

    const processedBinary = track(new cv.Mat());
    cv.bitwise_not(closedInverted, processedBinary);

    // --- 5. DÉFINITION DE LA ROI ---
    let roiX = Math.max(0, pixelX - Math.floor(floodWindowSize / 2));
    let roiY = Math.max(0, pixelY - Math.floor(floodWindowSize / 2));

    if (viewportBBox && Number.isFinite(viewportBBox.x)) {
      roiX = Math.max(0, Math.min(imageWidth - 1, Math.floor(viewportBBox.x)));
      roiY = Math.max(0, Math.min(imageHeight - 1, Math.floor(viewportBBox.y)));
    }

    let roiWidth = Math.min(imageWidth - roiX, viewportBBox?.width || floodWindowSize);
    let roiHeight = Math.min(imageHeight - roiY, viewportBBox?.height || floodWindowSize);

    const roiRect = new cv.Rect(roiX, roiY, Math.max(1, roiWidth), Math.max(1, roiHeight));
    const roiMat = track(processedBinary.roi(roiRect));

    // --- 6. FLOODFILL ---
    const mask = track(new cv.Mat.zeros(roiRect.height + 2, roiRect.width + 2, cv.CV_8UC1));
    const seedPoint = new cv.Point(pixelX - roiX, pixelY - roiY);

    cv.floodFill(
      roiMat,
      mask,
      seedPoint,
      new cv.Scalar(255),
      new cv.Rect(),
      new cv.Scalar(0),
      new cv.Scalar(0),
      4 | (255 << 8) | cv.FLOODFILL_MASK_ONLY
    );

    const maskRoi = track(mask.roi(new cv.Rect(1, 1, roiRect.width, roiRect.height)));

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
        const approx = track(new cv.Mat());
        cv.approxPolyDP(cnt, approx, EPSILON_PX, true);
        const pts = [];
        for (let j = 0; j < approx.rows; j++) {
          pts.push({
            x: approx.data32S[j * 2] + roiX,
            y: approx.data32S[j * 2 + 1] + roiY
          });
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