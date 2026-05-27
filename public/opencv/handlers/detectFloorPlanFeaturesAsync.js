/**
 * Detect walls and pillars from a floor plan image using morphological subtraction
 * and profile-thickness trimming to avoid overshoot artifacts.
 */
async function detectFloorPlanFeaturesAsync({ msg, payload }) {
  const matList = [];
  const track = (mat) => {
    if (mat) matList.push(mat);
    return mat;
  };

  try {
    const {
      imageUrl,
      targetThickness,
      tolerance = Math.max(2, Math.round((targetThickness || 0) * 0.3)),
      minWallLength = Math.max(20, Math.round((targetThickness || 0) * 4)),
      exclusionMaskBuffer = null,
      maskWidth = 0,
      maskHeight = 0,
      densityThreshold = 0.70,
      densityMinPassingSamples = 2,
    } = payload ?? {};

    if (!imageUrl) throw new Error("imageUrl is required");
    if (!(targetThickness > 0))
      throw new Error("targetThickness must be > 0 (image pixels)");

    // 1. Chargement de l'image et binarisation inverse
    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = track(cv.matFromImageData(imageData));
    const width = src.cols;
    const height = src.rows;

    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    const bw = track(new cv.Mat());
    cv.threshold(gray, bw, 128, 255, cv.THRESH_BINARY_INV);

    const bwOrig = track(bw.clone());

    // 2. Application du masque d'exclusion
    if (exclusionMaskBuffer && maskWidth === width && maskHeight === height) {
      const mask = new Uint8Array(exclusionMaskBuffer);
      const bwData = bw.data;
      const len = Math.min(mask.length, bwData.length);
      for (let i = 0; i < len; i++) {
        if (mask[i]) bwData[i] = 0;
      }
    }

    const minThickness = targetThickness - tolerance;
    const maxThickness = targetThickness + tolerance;

    const features = {
      horizontalWalls: [],
      verticalWalls: [],
      pillars: [],
    };

    // Nettoyage global pour enlever les textes et lignes de cotes fines
    const cleanBw = track(new cv.Mat());
    const kSize = Math.max(3, Math.floor(minThickness * 0.75));
    const squareKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kSize, kSize)),
    );
    cv.morphologyEx(bw, cleanBw, cv.MORPH_OPEN, squareKernel);

    // 3. Extraction des grands murs horizontaux et verticaux
    const horizontalWallsImg = track(new cv.Mat());
    const hKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(minWallLength, 1)),
    );
    cv.morphologyEx(cleanBw, horizontalWallsImg, cv.MORPH_OPEN, hKernel);

    const verticalWallsImg = track(new cv.Mat());
    const vKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, minWallLength)),
    );
    cv.morphologyEx(cleanBw, verticalWallsImg, cv.MORPH_OPEN, vKernel);

    // 4. SOUSTRACTION MORPHOLOGIQUE (Pour isoler les carrés et fragments manquants)
    const reconstructedWalls = track(new cv.Mat());
    cv.bitwise_or(horizontalWallsImg, verticalWallsImg, reconstructedWalls);

    const notReconstructed = track(new cv.Mat());
    cv.bitwise_not(reconstructedWalls, notReconstructed);

    const shortElementsImg = track(new cv.Mat());
    cv.bitwise_and(cleanBw, notReconstructed, shortElementsImg);

    // 5. Extraction des segments depuis les images de contours avec Trimming de profil
    const extractSegments = (binImg, isHorizontal, isShortElement = false) => {
      const segments = [];
      const contours = track(new cv.MatVector());
      const hierarchy = track(new cv.Mat());
      cv.findContours(
        binImg,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE,
      );

      const imgData = binImg.data;
      const imgCols = binImg.cols;

      for (let i = 0; i < contours.size(); ++i) {
        const rect = cv.boundingRect(contours.get(i));

        if (isShortElement && rect.width < 4 && rect.height < 4) continue;

        if (isHorizontal) {
          const thickness = rect.height;
          if (!isShortElement && (thickness < minThickness || thickness > maxThickness))
            continue;

          let x1 = rect.x;
          let x2 = rect.x + rect.width;

          // --- SÉCURITÉ ANTI-EXCROISSANCE POUR LES GRANDS MURS ---
          if (!isShortElement) {
            const minProfileCount = Math.max(2, Math.floor(minThickness * 0.5));

            // Balayage de gauche à droite pour trouver le vrai début fiable
            for (let x = rect.x; x < rect.x + rect.width; x++) {
              let colCount = 0;
              for (let y = rect.y; y < rect.y + rect.height; y++) {
                if (imgData[y * imgCols + x]) colCount++;
              }
              if (colCount >= minProfileCount) {
                x1 = x;
                break;
              }
            }

            // Balayage de droite à gauche pour éliminer les excroissances
            for (let x = rect.x + rect.width - 1; x >= x1; x--) {
              let colCount = 0;
              for (let y = rect.y; y < rect.y + rect.height; y++) {
                if (imgData[y * imgCols + x]) colCount++;
              }
              if (colCount >= minProfileCount) {
                x2 = x + 1;
                break;
              }
            }
          }

          const centerY = rect.y + rect.height / 2;
          if (x2 > x1) {
            segments.push({ x1, y1: centerY, x2, y2: centerY, thickness });
          }
        } else {
          const thickness = rect.width;
          if (!isShortElement && (thickness < minThickness || thickness > maxThickness))
            continue;

          let y1 = rect.y;
          let y2 = rect.y + rect.height;

          // --- SÉCURITÉ ANTI-EXCROISSANCE POUR LES GRANDS MURS ---
          if (!isShortElement) {
            const minProfileCount = Math.max(2, Math.floor(minThickness * 0.5));

            // Balayage du haut vers le bas
            for (let y = rect.y; y < rect.y + rect.height; y++) {
              let rowCount = 0;
              for (let x = rect.x; x < rect.x + rect.width; x++) {
                if (imgData[y * imgCols + x]) rowCount++;
              }
              if (rowCount >= minProfileCount) {
                y1 = y;
                break;
              }
            }

            // Balayage du bas vers le haut
            for (let y = rect.y + rect.height - 1; y >= y1; y--) {
              let rowCount = 0;
              for (let x = rect.x; x < rect.x + rect.width; x++) {
                if (imgData[y * imgCols + x]) rowCount++;
              }
              if (rowCount >= minProfileCount) {
                y2 = y + 1;
                break;
              }
            }
          }

          const centerX = rect.x + rect.width / 2;
          if (y2 > y1) {
            segments.push({ x1: centerX, y1, x2: centerX, y2, thickness });
          }
        }
      }
      return segments;
    };

    // Récupération des grands segments nettoyés des excroissances
    features.horizontalWalls = extractSegments(horizontalWallsImg, true, false);
    features.verticalWalls = extractSegments(verticalWallsImg, false, false);

    // Récupération et dispatch des petits éléments issus de la soustraction (inchangé)
    const shortContours = track(new cv.MatVector());
    const shortHierarchy = track(new cv.Mat());
    cv.findContours(
      shortElementsImg,
      shortContours,
      shortHierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE,
    );

    for (let i = 0; i < shortContours.size(); ++i) {
      const rect = cv.boundingRect(shortContours.get(i));
      if (rect.width < 4 && rect.height < 4) continue;

      if (rect.width >= rect.height) {
        const centerY = rect.y + rect.height / 2;
        features.horizontalWalls.push({
          x1: rect.x,
          y1: centerY,
          x2: rect.x + rect.width,
          y2: centerY,
          thickness: rect.height,
        });
      } else {
        const centerX = rect.x + rect.width / 2;
        features.verticalWalls.push({
          x1: centerX,
          y1: rect.y,
          x2: centerX,
          y2: rect.y + rect.height,
          thickness: rect.width,
        });
      }
    }

    // 6. Filtrage par densité (Inchangé)
    const bwOrigData = bwOrig.data;
    const bwCols = bwOrig.cols;
    const bwRows = bwOrig.rows;

    const blackDensity = (x, y, w, h) => {
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(bwCols, Math.ceil(x + w));
      const y1 = Math.min(bwRows, Math.ceil(y + h));
      if (x1 <= x0 || y1 <= y0) return 0;
      let count = 0;
      let total = 0;
      for (let py = y0; py < y1; py++) {
        const rowOff = py * bwCols;
        for (let px = x0; px < x1; px++) {
          total++;
          if (bwOrigData[rowOff + px]) count++;
        }
      }
      return total > 0 ? count / total : 0;
    };

    const SAMPLE_OFFSETS = [0.25, 0.5, 0.75];
    const wallPassesDensity = (wall, isHorizontal) => {
      const side = Math.max(1, wall.thickness);
      const half = side / 2;
      const len = isHorizontal ? wall.x2 - wall.x1 : wall.y2 - wall.y1;

      if (len <= side) {
        const d = isHorizontal
          ? blackDensity(wall.x1, wall.y1 - half, wall.x2 - wall.x1, side)
          : blackDensity(wall.x1 - half, wall.y1, side, wall.y2 - wall.y1);
        return d >= densityThreshold ? SAMPLE_OFFSETS.length : 0;
      }

      let passing = 0;
      for (const t of SAMPLE_OFFSETS) {
        const cx = isHorizontal ? wall.x1 + t * len : wall.x1;
        const cy = isHorizontal ? wall.y1 : wall.y1 + t * len;
        const d = blackDensity(cx - half, cy - half, side, side);
        if (d >= densityThreshold) passing++;
      }
      return passing;
    };

    features.horizontalWalls = features.horizontalWalls.filter(
      (w) => wallPassesDensity(w, true) >= densityMinPassingSamples,
    );
    features.verticalWalls = features.verticalWalls.filter(
      (w) => wallPassesDensity(w, false) >= densityMinPassingSamples,
    );

    postMessage({
      msg,
      payload: {
        ...features,
        imageSize: { width, height },
      },
    });
  } catch (err) {
    let errorMessage = err?.message || err;
    console.error(
      "[opencv worker] detectFloorPlanFeaturesAsync failed",
      errorMessage,
    );
    postMessage({ msg, error: errorMessage });
  } finally {
    matList.forEach((m) => m && !m.isDeleted() && m.delete());
  }
}
