/**
 * Detect walls and pillars from a floor plan image using morphological subtraction,
 * profile-thickness trimming, and center-alignment corrections.
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

    // --- CORRECTION 1 : FORCER LES NOYAUX À ÊTRE IMPAIRS ---
    let kSize = Math.max(3, Math.floor(minThickness * 0.75));
    if (kSize % 2 === 0) kSize += 1;

    // Nettoyage global pour enlever les textes et lignes de cotes fines
    const cleanBw = track(new cv.Mat());
    const squareKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kSize, kSize)),
    );
    cv.morphologyEx(bw, cleanBw, cv.MORPH_OPEN, squareKernel);

    const cleanBwData = cleanBw.data;

    // 3. Extraction des petits segments / poteaux isolés depuis l'image nettoyée
    {
      const contours = track(new cv.MatVector());
      const hierarchy = track(new cv.Mat());
      cv.findContours(
        cleanBw,
        contours,
        hierarchy,
        cv.RETR_LIST,
        cv.CHAIN_APPROX_SIMPLE,
      );

      for (let i = 0; i < contours.size(); ++i) {
        const rect = cv.boundingRect(contours.get(i));

        const isShortW = rect.width < minWallLength;
        const isShortH = rect.height < minWallLength;

        if (
          isShortW &&
          isShortH &&
          (rect.width >= minThickness || rect.height >= minThickness)
        ) {
          if (rect.width >= rect.height) {
            // Mini segment Horizontal (Correction -0.5px incluse)
            const centerY = rect.y + rect.height / 2 - 0.5;
            features.horizontalWalls.push({
              x1: rect.x,
              y1: centerY,
              x2: rect.x + rect.width,
              y2: centerY,
              thickness: rect.height,
            });
          } else {
            // Mini segment Vertical (Correction -0.5px incluse)
            const centerX = rect.x + rect.width / 2 - 0.5;
            features.verticalWalls.push({
              x1: centerX,
              y1: rect.y,
              x2: centerX,
              y2: rect.y + rect.height,
              thickness: rect.width,
            });
          }
        }
      }
    }

    // --- CORRECTION 1 (SUITE) : LONGUEURS DE NOYAUX IMPAIRES ---
    let hKernelLength = minWallLength;
    if (hKernelLength % 2 === 0) hKernelLength += 1;

    let vKernelLength = minWallLength;
    if (vKernelLength % 2 === 0) vKernelLength += 1;

    const horizontalWallsImg = track(new cv.Mat());
    const hKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(hKernelLength, 1)),
    );
    cv.morphologyEx(cleanBw, horizontalWallsImg, cv.MORPH_OPEN, hKernel);

    const verticalWallsImg = track(new cv.Mat());
    const vKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, vKernelLength)),
    );
    cv.morphologyEx(cleanBw, verticalWallsImg, cv.MORPH_OPEN, vKernel);

    // 4. SOUSTRACTION MORPHOLOGIQUE (Pour isoler les morceaux restants)
    const reconstructedWalls = track(new cv.Mat());
    cv.bitwise_or(horizontalWallsImg, verticalWallsImg, reconstructedWalls);

    const notReconstructed = track(new cv.Mat());
    cv.bitwise_not(reconstructedWalls, notReconstructed);

    const shortElementsImg = track(new cv.Mat());
    cv.bitwise_and(cleanBw, notReconstructed, shortElementsImg);

    // 5. Extraction des grands segments avec Trimming et Correction d'alignement
    const extractSegments = (binImg, isHorizontal) => {
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

        if (isHorizontal) {
          const thickness = rect.height;
          if (thickness < minThickness || thickness > maxThickness) continue;

          let x1 = rect.x;
          let x2 = rect.x + rect.width;

          const minProfileCount = Math.max(2, Math.floor(minThickness * 0.5));

          // Balayage de gauche à droite
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

          // Balayage de droite à gauche (Anti-excroissance)
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

          // CORRECTION 2 : AJUSTEMENT -0.5 PX DE L'AXE Y
          const centerY = rect.y + rect.height / 2 - 0.5;
          if (x2 > x1) {
            segments.push({ x1, y1: centerY, x2, y2: centerY, thickness });
          }
        } else {
          const thickness = rect.width;
          if (thickness < minThickness || thickness > maxThickness) continue;

          let y1 = rect.y;
          let y2 = rect.y + rect.height;

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

          // CORRECTION 2 : AJUSTEMENT -0.5 PX DE L'AXE X
          const centerX = rect.x + rect.width / 2 - 0.5;
          if (y2 > y1) {
            segments.push({ x1: centerX, y1, x2: centerX, y2, thickness });
          }
        }
      }
      return segments;
    };

    // Récupération des grands segments nettoyés des excroissances
    features.horizontalWalls = extractSegments(horizontalWallsImg, true);
    features.verticalWalls = extractSegments(verticalWallsImg, false);

    // Récupération et dispatch des petits éléments issus de la soustraction
    const shortContours = track(new cv.MatVector());
    const shortHierarchy = track(new cv.Mat());
    cv.findContours(
      shortElementsImg,
      shortContours,
      shortHierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE,
    );

    // --- ORIENTATION PERPENDICULAIRE AUX GRANDS MURS ADJACENTS ---
    // Quand un petit bout est "collé" à un grand mur (typiquement une
    // amorce de T-junction ou un coin que la morpho longue n'a pas
    // capturé), son axe doit être normal au mur qu'il touche pour ne
    // pas être confondu avec une simple extension parallèle par les
    // algos de clean en aval. On compte les pixels foreground des deux
    // images de grands murs sur les 4 bords immédiatement extérieurs au
    // bbox du contour : la direction d'adjacence dominante détermine
    // l'axe perpendiculaire choisi. Si rien n'est adjacent, on retombe
    // sur le ratio largeur/hauteur du bbox.
    const hImgData = horizontalWallsImg.data;
    const vImgData = verticalWallsImg.data;
    const countAdjacentH = (rect) => {
      let count = 0;
      const yAbove = rect.y - 1;
      if (yAbove >= 0) {
        const rowOff = yAbove * width;
        const xEnd = Math.min(width, rect.x + rect.width);
        for (let x = Math.max(0, rect.x); x < xEnd; x++) {
          if (hImgData[rowOff + x]) count++;
        }
      }
      const yBelow = rect.y + rect.height;
      if (yBelow < height) {
        const rowOff = yBelow * width;
        const xEnd = Math.min(width, rect.x + rect.width);
        for (let x = Math.max(0, rect.x); x < xEnd; x++) {
          if (hImgData[rowOff + x]) count++;
        }
      }
      return count;
    };
    const countAdjacentV = (rect) => {
      let count = 0;
      const xLeft = rect.x - 1;
      const yEnd = Math.min(height, rect.y + rect.height);
      const yStart = Math.max(0, rect.y);
      if (xLeft >= 0) {
        for (let y = yStart; y < yEnd; y++) {
          if (vImgData[y * width + xLeft]) count++;
        }
      }
      const xRight = rect.x + rect.width;
      if (xRight < width) {
        for (let y = yStart; y < yEnd; y++) {
          if (vImgData[y * width + xRight]) count++;
        }
      }
      return count;
    };

    // Build the axis registries used by the isolated-contour pass below.
    // We seed them with every big wall now and append each touching stub
    // we classify in pass 1, so the isolated pass can compare against
    // both classes of references.
    const horizontalAxes = features.horizontalWalls.map((w) => ({
      y: w.y1,
      x1: w.x1,
      x2: w.x2,
      thickness: w.thickness,
    }));
    const verticalAxes = features.verticalWalls.map((w) => ({
      x: w.x1,
      y1: w.y1,
      y2: w.y2,
      thickness: w.thickness,
    }));

    // Helpers that push a classified small contour to the output AND to
    // the matching axis registry so it becomes a reference for pass 2.
    const pushHorizontalSegment = (rect) => {
      const centerY = rect.y + rect.height / 2 - 0.5;
      const seg = {
        x1: rect.x,
        y1: centerY,
        x2: rect.x + rect.width,
        y2: centerY,
        thickness: rect.height,
      };
      features.horizontalWalls.push(seg);
      horizontalAxes.push({
        y: centerY,
        x1: seg.x1,
        x2: seg.x2,
        thickness: seg.thickness,
      });
    };
    const pushVerticalSegment = (rect) => {
      const centerX = rect.x + rect.width / 2 - 0.5;
      const seg = {
        x1: centerX,
        y1: rect.y,
        x2: centerX,
        y2: rect.y + rect.height,
        thickness: rect.width,
      };
      features.verticalWalls.push(seg);
      verticalAxes.push({
        x: centerX,
        y1: seg.y1,
        y2: seg.y2,
        thickness: seg.thickness,
      });
    };

    // --- PASS 1 — touching stubs (perpendicular to adjacent big wall) ---
    // Isolated contours (hAdj === 0 && vAdj === 0) are deferred to pass 2
    // so they can lean on the stubs we classify here when picking an
    // orientation.
    const isolatedRects = [];
    for (let i = 0; i < shortContours.size(); ++i) {
      const rect = cv.boundingRect(shortContours.get(i));
      if (rect.width < 4 && rect.height < 4) continue;

      const hAdj = countAdjacentH(rect);
      const vAdj = countAdjacentV(rect);

      if (hAdj === 0 && vAdj === 0) {
        isolatedRects.push(rect);
        continue;
      }

      // Adjacence dominante → orientation perpendiculaire.
      if (hAdj > vAdj) {
        pushVerticalSegment(rect); // collé à un mur H → segment vertical
      } else if (vAdj > hAdj) {
        pushHorizontalSegment(rect); // collé à un mur V → segment horizontal
      } else {
        // Égalité non nulle (jonction T touchant H et V) → on prend la
        // direction la plus naturelle d'après le ratio d'aspect.
        if (rect.width >= rect.height) pushHorizontalSegment(rect);
        else pushVerticalSegment(rect);
      }
    }

    // --- Cluster collinear axes before pass 2 ---
    // Two big-wall sections (or touching stubs) sitting at the same Y but
    // separated by an opening should be treated as one logical row: an
    // isolated fragment between them still belongs to that row even
    // though no single member covers its X. We sort the registries by
    // perpendicular position and merge entries whose perpendicular gap
    // is within max(thickness)/2 — the unioned parallel span covers the
    // whole row.
    const mergeAxes = (axes, perpKey, lo, hi) => {
      if (axes.length === 0) return [];
      const sorted = [...axes].sort((a, b) => a[perpKey] - b[perpKey]);
      const out = [];
      for (const a of sorted) {
        const last = out.length > 0 ? out[out.length - 1] : null;
        const gap = last ? Math.abs(a[perpKey] - last[perpKey]) : Infinity;
        const merge = last && gap <= Math.max(last.thickness, a.thickness) / 2;
        if (merge) {
          last[perpKey] = (last[perpKey] + a[perpKey]) / 2;
          last[lo] = Math.min(last[lo], a[lo]);
          last[hi] = Math.max(last[hi], a[hi]);
          last.thickness = Math.max(last.thickness, a.thickness);
        } else {
          out.push({ ...a });
        }
      }
      return out;
    };
    const mergedHAxes = mergeAxes(horizontalAxes, "y", "x1", "x2");
    const mergedVAxes = mergeAxes(verticalAxes, "x", "y1", "y2");

    // --- PASS 2 — isolated contours, oriented by nearest classified axis ---
    // A horizontal axis is considered to "contain" a centroid when the
    // centroid sits within ± thickness/2 of the axis line AND inside its
    // (merged) parallel span — extended by `parallelSlack` to absorb
    // small overshoots past the row's leftmost / rightmost end. Same
    // logic for vertical axes. The closer of the two candidates
    // (perpendicular distance) wins; tie → aspect ratio.
    const parallelSlack = minWallLength;
    const findClosestHAxis = (cx, cy) => {
      let best = null;
      for (const a of mergedHAxes) {
        if (cx < a.x1 - parallelSlack || cx > a.x2 + parallelSlack) continue;
        const d = Math.abs(cy - a.y);
        if (d > a.thickness / 2) continue;
        if (best === null || d < best) best = d;
      }
      return best;
    };
    const findClosestVAxis = (cx, cy) => {
      let best = null;
      for (const a of mergedVAxes) {
        if (cy < a.y1 - parallelSlack || cy > a.y2 + parallelSlack) continue;
        const d = Math.abs(cx - a.x);
        if (d > a.thickness / 2) continue;
        if (best === null || d < best) best = d;
      }
      return best;
    };

    for (const rect of isolatedRects) {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const bestH = findClosestHAxis(cx, cy);
      const bestV = findClosestVAxis(cx, cy);

      let isHorizontalSegment;
      if (bestH !== null && (bestV === null || bestH < bestV)) {
        isHorizontalSegment = true;
      } else if (bestV !== null && (bestH === null || bestV < bestH)) {
        isHorizontalSegment = false;
      } else {
        // Aucun axe candidat (ou égalité parfaite) → fallback ratio d'aspect.
        isHorizontalSegment = rect.width >= rect.height;
      }

      if (isHorizontalSegment) pushHorizontalSegment(rect);
      else pushVerticalSegment(rect);
    }

    // 6. Filtrage par densité final (basé sur bwOrig)
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

    // Envoi des résultats
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
    // Libération stricte de la mémoire WebAssembly
    matList.forEach((m) => m && !m.isDeleted() && m.delete());
  }
}
