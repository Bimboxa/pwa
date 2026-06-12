/**
 * Vectorize horizontal / vertical black wall lines into 2-point segments.
 *
 * Two-phase pipeline ("global detection → local optimization"):
 *
 *   PHASE 1 — global candidate detection (morphology):
 *     binarize (inverse) → exclusion mask → square MORPH_OPEN to drop text /
 *     thin dimension lines → long horizontal / vertical MORPH_OPEN kernels →
 *     connected components whose cross-dimension fits the target thickness
 *     band become segment candidates (axis ~ centered on the black line).
 *
 *   PHASE 2 — per-candidate local optimization (pixel-by-pixel on the
 *   pre-morphology binary). The optimized segment is a rectangle of FIXED
 *   width (= the target thickness, i.e. the strokeWidth of the annotation
 *   being drawn) and fixed orientation — only its perpendicular translation
 *   and its length are adjusted; the band under it may well be thinner or
 *   thicker than the segment, that's fine:
 *     2a. translate: slide the target-width window perpendicular to the
 *         axis and keep the position maximizing black-pixel coverage over
 *         the candidate span (plateau center → centered on the band).
 *     2b. length: trim to the first/last solid perpendicular profile of the
 *         translated window, then extend outward while profiles stay solid
 *         (recovers the ends eaten by the opening kernel), capped at
 *         extendCapPx.
 *     2c. re-translate over the refined span (the extension may have
 *         shifted the optimal centering).
 *     2d. acceptance: min length + foreground density under the final
 *         rectangle + per-position fill of the band AND of its central core
 *         (most positions along the span must individually cover a filled,
 *         CENTERED band — rejects fans of radial lines whose average
 *         density passes, and fan sectors framed by two radial lines at the
 *         band edges with white in between) + straightness (the
 *         perpendicular centroid of the black pixels must not drift along
 *         the span — rejects diagonals) + containment (widening the band
 *         must add mostly NON-black pixels — otherwise the band sits inside
 *         a larger dark region, e.g. a blurred stair fan binarized into a
 *         dark blob, and the detection is meaningless).
 *     2e. collinear merge: same-axis candidates with overlapping spans are
 *         merged (extension can make phase-1 fragments overlap) — each
 *         merge is re-validated by the coverage gate so fragments sitting
 *         on slightly offset bands are kept separate instead of producing
 *         an averaged segment that covers neither band.
 *
 * The target thickness constrains both phases: kernel sizes + thickness
 * band in phase 1, fixed window width + search range in phase 2.
 *
 * Output walls use the same contract as detectFloorPlanFeaturesAsync:
 * { x1, y1, x2, y2, thickness } in image pixels, horizontal walls with
 * y1 === y2 (axis), vertical walls with x1 === x2. Thickness is always the
 * target thickness — the segments are drawn at the toolbar width.
 */
async function detectWallSegmentsAsync({ msg, payload }) {
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
      colFillThreshold = 0.6,
      extendCapPx = 2 * Math.max(20, Math.round((targetThickness || 0) * 4)),
      // Black coverage required under the drawn rectangle. Matches the
      // phase-1 thickness tolerance: a band at the thin end of the gate
      // ((1 - 30%) × target) fills exactly 70% of the target-width window
      // and must pass, while anything thinner (parking markings, partition
      // lines) is not a wall and must be rejected.
      acceptDensity = 0.7,
      // Straightness gate: max drift of the perpendicular black-pixel
      // centroid between the first and last thirds of the span, as a
      // fraction of the segment width. Rejects diagonals (door swings,
      // hatching) that pass the density check. Note the thirds comparison
      // measures 2/3 of the total drift, and a diagonal sneaking through
      // the phase-1 width gate drifts at most ~(tolerance + line width)
      // in total — 1/4 sits safely below that worst case while staying
      // far above the ~2px drift of a wall with one-sided attached marks.
      maxAxisDriftRatio = 1 / 4,
      // Minimum fraction of positions along the span whose band fill
      // individually reaches colFillThreshold — the average density can
      // pass over a fan of radial lines while most positions sit on white.
      minColPassRatio = 0.85,
      // Containment gate: max black density allowed in the widened side
      // strips (T/3 each side). Above it, the band sits inside a larger
      // dark region (blurred fan, blob, hatching) — not on an isolated
      // black band.
      sideMaxDensity = 0.5,
      mergeGapPx = 2,
    } = payload ?? {};

    if (!imageUrl) throw new Error("imageUrl is required");
    if (!(targetThickness > 0))
      throw new Error("targetThickness must be > 0 (image pixels)");

    // 1. Load + inverse binarization (black walls → 255)
    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = track(cv.matFromImageData(imageData));
    const width = src.cols;
    const height = src.rows;

    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    const bw = track(new cv.Mat());
    cv.threshold(gray, bw, 128, 255, cv.THRESH_BINARY_INV);

    // 2. Exclusion mask (already-annotated zones zeroed out — phase-2
    // extension then stops naturally at annotated walls).
    if (exclusionMaskBuffer && maskWidth === width && maskHeight === height) {
      const mask = new Uint8Array(exclusionMaskBuffer);
      const bwData = bw.data;
      const len = Math.min(mask.length, bwData.length);
      for (let i = 0; i < len; i++) {
        if (mask[i]) bwData[i] = 0;
      }
    }

    const minThickness = Math.max(1, targetThickness - tolerance);
    const maxThickness = targetThickness + tolerance;

    // --- PHASE 1 : global candidate detection ---

    let kSize = Math.max(3, Math.floor(minThickness * 0.75));
    if (kSize % 2 === 0) kSize += 1;

    const cleanBw = track(new cv.Mat());
    const squareKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kSize, kSize))
    );
    cv.morphologyEx(bw, cleanBw, cv.MORPH_OPEN, squareKernel);

    let kLen = minWallLength;
    if (kLen % 2 === 0) kLen += 1;

    const hImg = track(new cv.Mat());
    const hKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kLen, 1))
    );
    cv.morphologyEx(cleanBw, hImg, cv.MORPH_OPEN, hKernel);

    const vImg = track(new cv.Mat());
    const vKernel = track(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, kLen))
    );
    cv.morphologyEx(cleanBw, vImg, cv.MORPH_OPEN, vKernel);

    // Candidates: { axis, lo, hi, isHorizontal } — axis is the centerline
    // (perpendicular coord, -0.5 px center convention), [lo, hi) the span
    // along the segment direction.
    const candidates = [];
    const collectCandidates = (img, isHorizontal) => {
      const contours = track(new cv.MatVector());
      const hierarchy = track(new cv.Mat());
      cv.findContours(
        img,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );
      for (let i = 0; i < contours.size(); ++i) {
        const rect = cv.boundingRect(contours.get(i));
        const crossDim = isHorizontal ? rect.height : rect.width;
        if (crossDim < minThickness || crossDim > maxThickness) continue;
        candidates.push({
          axis: isHorizontal
            ? rect.y + rect.height / 2 - 0.5
            : rect.x + rect.width / 2 - 0.5,
          lo: isHorizontal ? rect.x : rect.y,
          hi: isHorizontal ? rect.x + rect.width : rect.y + rect.height,
          isHorizontal,
        });
      }
    };
    collectCandidates(hImg, true);
    collectCandidates(vImg, false);

    // --- PHASE 2 : per-candidate local optimization on the pre-morphology
    // binary (bw) ---

    const data = bw.data;
    // readPx(par, perp): par = coord along the segment, perp = across it.
    const readPxH = (par, perp) => data[perp * width + par];
    const readPxV = (par, perp) => data[par * width + perp];

    // Fixed segment width (image px) — the only degrees of freedom of the
    // optimization are the perpendicular translation and the length.
    const T = Math.max(1, Math.round(targetThickness));

    const refineCandidate = (c) => {
      const readPx = c.isHorizontal ? readPxH : readPxV;
      const perpMax = c.isHorizontal ? height : width; // perpendicular extent
      const parMax = c.isHorizontal ? width : height; // parallel extent

      if (c.hi - c.lo <= 0) return null;

      // Perpendicular search range: the phase-1 axis comes from the bbox
      // center of the morphology component, so the optimal translation is
      // within ±tolerance of it (plus T/2 on each side for the window
      // itself).
      const pLo = Math.max(0, Math.floor(c.axis + 0.5 - T / 2 - tolerance));
      const pHi = Math.min(
        perpMax,
        Math.ceil(c.axis + 0.5 + T / 2 + tolerance)
      );
      if (pHi - pLo < T) return null; // hugging the image border

      // Slide the T-wide window across [pLo, pHi) and return the axis of
      // the position maximizing black-pixel coverage over the parallel span
      // [qLo, qHi). Optimal positions form a plateau when the band under
      // the segment is thinner than T — its center puts the segment exactly
      // centered on the band.
      const bestTranslation = (qLo, qHi) => {
        const profile = [];
        for (let p = pLo; p < pHi; p++) {
          let count = 0;
          for (let q = qLo; q < qHi; q++) {
            if (readPx(q, p)) count++;
          }
          profile.push(count);
        }
        let sum = 0;
        for (let i = 0; i < T; i++) sum += profile[i];
        let bestSum = sum;
        let plateauStart = 0;
        let plateauEnd = 0;
        for (let s = 1; s + T <= profile.length; s++) {
          sum += profile[s + T - 1] - profile[s - 1];
          if (sum > bestSum) {
            bestSum = sum;
            plateauStart = s;
            plateauEnd = s;
          } else if (sum === bestSum) {
            plateauEnd = s;
          }
        }
        if (bestSum <= 0) return null;
        const sStar = (plateauStart + plateauEnd) / 2;
        return pLo + sStar + T / 2 - 0.5;
      };

      // 2a. Translate the window to best cover the band under the
      // phase-1 candidate span.
      const firstAxis = bestTranslation(c.lo, c.hi);
      if (firstAxis == null) return null;

      // 2b. Length: trim to solid perpendicular profiles of the translated
      // window, then extend.
      const band0 = Math.max(0, Math.round(firstAxis + 0.5 - T / 2));
      const band1 = Math.min(perpMax, band0 + T);
      const bandH = Math.max(1, band1 - band0);
      const colPass = (q) => {
        let count = 0;
        for (let p = band0; p < band1; p++) {
          if (readPx(q, p)) count++;
        }
        return count / bandH >= colFillThreshold;
      };

      let lo = -1;
      for (let q = c.lo; q < c.hi; q++) {
        if (colPass(q)) {
          lo = q;
          break;
        }
      }
      if (lo < 0) return null;
      let hi = lo + 1;
      for (let q = c.hi - 1; q >= lo; q--) {
        if (colPass(q)) {
          hi = q + 1;
          break;
        }
      }

      // Extend outward while profiles stay solid — recovers the ends eaten
      // by the opening kernel. A single-pixel gap is tolerated (anti-aliasing
      // noise), anything wider stops the walk.
      const extendLimitLo = Math.max(0, lo - extendCapPx);
      let gap = 0;
      for (let q = lo - 1; q >= extendLimitLo; q--) {
        if (colPass(q)) {
          lo = q;
          gap = 0;
        } else if (++gap > 1) break;
      }
      const extendLimitHi = Math.min(parMax, hi + extendCapPx);
      gap = 0;
      for (let q = hi; q < extendLimitHi; q++) {
        if (colPass(q)) {
          hi = q + 1;
          gap = 0;
        } else if (++gap > 1) break;
      }

      if (hi - lo < minWallLength) return null;

      // 2c. Re-translate over the refined span — the extension may have
      // shifted the optimal centering.
      const axis = bestTranslation(lo, hi) ?? firstAxis;

      // 2d. Acceptance: density of the fixed-width window centered on the
      // final axis, over the refined span — plus a straightness check on
      // the perpendicular centroid of the black pixels.
      const cb0 = Math.max(0, Math.round(axis + 0.5 - T / 2));
      const cb1 = Math.min(perpMax, cb0 + T);
      let fg = 0;
      // Straightness stats are accumulated over the FULL search range
      // [pLo, pHi), not just the band: the band window clips the pixels of
      // a diagonal that overflow it, which compresses the measured drift
      // right down to the threshold.
      let count0 = 0;
      let sum0 = 0;
      let count2 = 0;
      let sum2 = 0;
      const third = (hi - lo) / 3;
      // Per-position fill check: trim / extension only look at the span
      // ENDS, so the middle of the span is never validated — over a fan of
      // radial lines the AVERAGE density can pass while most individual
      // positions sit on white. Each position must individually fill the
      // band (colFillThreshold) AND fill the CENTRAL CORE of the band
      // (T/2 around the axis): a fan sector framed by two radial lines —
      // one at each band edge, white in between — passes the plain fill
      // ratio, but its core is empty, whereas a true centered band always
      // covers the core.
      const bandFillMin = colFillThreshold * Math.max(1, cb1 - cb0);
      const core0 = Math.max(0, Math.round(axis + 0.5 - T / 4));
      const core1 = Math.min(
        perpMax,
        Math.max(core0 + 1, Math.round(axis + 0.5 + T / 4))
      );
      const coreFillMin = colFillThreshold * (core1 - core0);
      let passingCols = 0;
      for (let q = lo; q < hi; q++) {
        const inFirstThird = q < lo + third;
        const inLastThird = q >= hi - third;
        let colCount = 0;
        let coreCount = 0;
        for (let p = pLo; p < pHi; p++) {
          if (readPx(q, p)) {
            if (p >= cb0 && p < cb1) {
              fg++;
              colCount++;
              if (p >= core0 && p < core1) coreCount++;
            }
            if (inFirstThird) {
              count0++;
              sum0 += p;
            } else if (inLastThird) {
              count2++;
              sum2 += p;
            }
          }
        }
        if (colCount >= bandFillMin && coreCount >= coreFillMin) passingCols++;
      }
      const density = fg / ((hi - lo) * Math.max(1, cb1 - cb0));
      if (density < acceptDensity) return null;
      if (passingCols / (hi - lo) < minColPassRatio) return null;

      // Straightness: a true H / V wall keeps its black pixels centered on
      // the axis all along the span; a diagonal line (door swing, hatching)
      // that slipped through phase 1 sweeps across the band — its centroid
      // drifts between the first and last thirds of the span. Reject when
      // the drift exceeds a fraction of the segment width.
      if (count0 > 0 && count2 > 0) {
        const drift = Math.abs(sum0 / count0 - sum2 / count2);
        if (drift > T * maxAxisDriftRatio) return null;
      }

      // Containment ("band inside a black area") check: widen the band by a
      // margin on each side — for a true isolated wall the new pixels are
      // mostly white; if they are mostly black too, the band sits INSIDE a
      // larger dark region (blurred stair fans, dense hatching, blobs
      // thicker than target + tolerance) and the detection is meaningless.
      // The margin of T/3 with a 0.5 threshold tolerates a wall at the
      // thick end of the phase-1 gate (1.3 × T: ~0.45 side density) and
      // crossing perpendicular walls (short black side sections).
      const m = Math.max(2, Math.round(T / 3));
      let sideFg = 0;
      let sideTot = 0;
      const s0 = Math.max(0, cb0 - m);
      const s1 = Math.min(perpMax, cb1 + m);
      for (let q = lo; q < hi; q++) {
        for (let p = s0; p < cb0; p++) {
          sideTot++;
          if (readPx(q, p)) sideFg++;
        }
        for (let p = cb1; p < s1; p++) {
          sideTot++;
          if (readPx(q, p)) sideFg++;
        }
      }
      if (sideTot > 0 && sideFg / sideTot > sideMaxDensity) return null;

      return { axis, lo, hi };
    };

    const refinedH = [];
    const refinedV = [];
    for (const c of candidates) {
      const r = refineCandidate(c);
      if (!r) continue;
      (c.isHorizontal ? refinedH : refinedV).push(r);
    }

    // Black coverage of a T-wide band centered on `axis` over [lo, hi) —
    // same metric as the 2d acceptance, reused to validate merges.
    const segCoverage = (axis, lo, hi, isHorizontal) => {
      const perpMax = isHorizontal ? height : width;
      const b0 = Math.max(0, Math.round(axis + 0.5 - T / 2));
      const b1 = Math.min(perpMax, b0 + T);
      let fg = 0;
      for (let p = b0; p < b1; p++) {
        for (let q = lo; q < hi; q++) {
          if (isHorizontal ? data[p * width + q] : data[q * width + p]) fg++;
        }
      }
      return fg / Math.max(1, (hi - lo) * (b1 - b0));
    };

    // 2e. Collinear merge — extension can make phase-1 fragments of the
    // same wall overlap. Unlike the axis-row clustering of
    // detectFloorPlanFeaturesAsync, span overlap is required so two distinct
    // walls sitting on the same axis do NOT merge. Sweep to fixpoint
    // (a merge can bridge to the next fragment).
    //
    // Each merge must itself pass the coverage gate: two fragments centered
    // on slightly offset bands (a stepped parking-row line, a chain of
    // aligned-but-distinct marks) each pass 2d individually, but the merged
    // segment at the averaged axis covers neither band — accepting it would
    // reintroduce segments sitting on white. When the merged coverage fails,
    // the fragments are kept separate.
    const mergeCollinear = (segs, isHorizontal) => {
      let merged = true;
      let out = segs;
      while (merged) {
        merged = false;
        out.sort((a, b) => a.axis - b.axis || a.lo - b.lo);
        const next = [];
        for (const s of out) {
          const last = next.length > 0 ? next[next.length - 1] : null;
          const sameAxis = last && Math.abs(s.axis - last.axis) <= T / 2;
          const spansTouch = last && s.lo <= last.hi + mergeGapPx;
          if (sameAxis && spansTouch) {
            // Length-weighted average of axes, span union.
            const lenA = last.hi - last.lo;
            const lenB = s.hi - s.lo;
            const mAxis = (last.axis * lenA + s.axis * lenB) / (lenA + lenB);
            const mLo = Math.min(last.lo, s.lo);
            const mHi = Math.max(last.hi, s.hi);
            if (segCoverage(mAxis, mLo, mHi, isHorizontal) >= acceptDensity) {
              last.axis = mAxis;
              last.lo = mLo;
              last.hi = mHi;
              merged = true;
              continue;
            }
          }
          next.push({ ...s });
        }
        out = next;
      }
      return out;
    };

    const horizontalWalls = mergeCollinear(refinedH, true).map((s) => ({
      x1: s.lo,
      y1: s.axis,
      x2: s.hi,
      y2: s.axis,
      thickness: T,
    }));
    const verticalWalls = mergeCollinear(refinedV, false).map((s) => ({
      x1: s.axis,
      y1: s.lo,
      x2: s.axis,
      y2: s.hi,
      thickness: T,
    }));

    postMessage({
      msg,
      payload: {
        horizontalWalls,
        verticalWalls,
        imageSize: { width, height },
      },
    });
  } catch (err) {
    let errorMessage = err?.message || err;
    console.error(
      "[opencv worker] detectWallSegmentsAsync failed",
      errorMessage
    );
    postMessage({ msg, error: errorMessage });
  } finally {
    // Libération stricte de la mémoire WebAssembly
    matList.forEach((m) => m && !m.isDeleted() && m.delete());
  }
}
