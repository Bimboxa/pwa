/**
 * Rigid template matching (cv.matchTemplate, grayscale, TM_CCOEFF_NORMED).
 *
 * Input payload:
 *   {
 *     patternData : ImageData   // the reference patch (annotation bbox crop)
 *     imageData   : ImageData   // the haystack (full basemap or a sub-window)
 *     threshold?  : number      // default 0.8, normalized correlation score
 *     maxMatches? : number      // optional cap (best-scoring first)
 *   }
 *
 * Returns { matches: [{ x, y, score }], patternWidth, patternHeight } where
 * (x, y) is the top-left of the matched region, in `imageData` pixel space.
 * Greedy non-maximum suppression collapses the dense cluster matchTemplate
 * produces around each occurrence into a single best hit.
 */
async function findPattern({ msg, payload }) {
  const { patternData, imageData } = payload;
  const threshold =
    typeof payload.threshold === "number" ? payload.threshold : 0.8;
  const maxMatches =
    typeof payload.maxMatches === "number" ? payload.maxMatches : Infinity;

  const patternMat = cv.matFromImageData(patternData);
  const srcMat = cv.matFromImageData(imageData);

  const srcGray = new cv.Mat();
  cv.cvtColor(srcMat, srcGray, cv.COLOR_RGBA2GRAY);
  const patternGray = new cv.Mat();
  cv.cvtColor(patternMat, patternGray, cv.COLOR_RGBA2GRAY);

  const patternWidth = patternGray.cols;
  const patternHeight = patternGray.rows;

  // matchTemplate requires the template to fit inside the source.
  if (patternWidth > srcGray.cols || patternHeight > srcGray.rows) {
    srcMat.delete();
    patternMat.delete();
    srcGray.delete();
    patternGray.delete();
    postMessage({ msg, payload: { matches: [], patternWidth, patternHeight } });
    return;
  }

  const result = new cv.Mat();
  cv.matchTemplate(srcGray, patternGray, result, cv.TM_CCOEFF_NORMED);

  // result is CV_32F — use the float view (.data is raw bytes).
  const scores = result.data32F;
  const resW = result.cols;
  const resH = result.rows;

  const candidates = [];
  for (let y = 0; y < resH; y++) {
    for (let x = 0; x < resW; x++) {
      const score = scores[y * resW + x];
      if (score >= threshold) candidates.push({ x, y, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  // Greedy NMS: a candidate within half-pattern of a kept hit is a duplicate.
  const supX = patternWidth * 0.5;
  const supY = patternHeight * 0.5;
  const matches = [];
  for (const c of candidates) {
    let suppressed = false;
    for (const k of matches) {
      if (Math.abs(c.x - k.x) < supX && Math.abs(c.y - k.y) < supY) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) {
      matches.push(c);
      if (matches.length >= maxMatches) break;
    }
  }

  srcMat.delete();
  patternMat.delete();
  srcGray.delete();
  patternGray.delete();
  result.delete();

  postMessage({ msg, payload: { matches, patternWidth, patternHeight } });
}
