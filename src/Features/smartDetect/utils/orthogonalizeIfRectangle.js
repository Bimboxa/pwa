/**
 * Post-processing step for the SURFACE_DROP flood-fill contour.
 *
 * If the detected polygon is close enough to a rectangle aligned on the
 * ortho axes, replace it with the 4 rectangle corners. Otherwise return
 * the polygon unchanged.
 *
 * Two passes:
 *   1. FULL bounding rectangle in the ortho frame. If the polygon covers
 *      ≥ `rectangleAreaRatio` of its area, snap.
 *   2. TRIMMED bounding rectangle — same but on the SHORTER axis we drop
 *      the lowest and highest ~10% of projections. This absorbs small
 *      bumps / ears that inflate the full bbox and sink the fillRatio.
 *      The snap fires only when the polygon's area is within
 *      [rectangleAreaRatio, 1 + outlierTolerance] of the trimmed rect —
 *      anything above `1 + outlierTolerance` means the "bump" is too big
 *      to discard.
 *
 * Area computation is done via shoelace on the original (x, y) points —
 * rotation preserves area so there's no need to project first.
 *
 * @param {Array<{x,y}>} points     Input polygon (≥ 3 pts), image-px coords.
 * @param {number} orthoAngleRad    Ortho frame rotation (same sign
 *                                  convention as detectStripFromLoupe /
 *                                  floodFillFromLoupe).
 * @param {object} [opts]
 * @param {number} [opts.rectangleAreaRatio=0.80]
 * @param {number} [opts.trimFraction=0.10]    Fraction trimmed each side.
 * @param {number} [opts.outlierTolerance=0.15]
 * @returns {Array<{x,y}>}          Input or 4-corner rectangle.
 */
export default function orthogonalizeIfRectangle(
  points,
  orthoAngleRad = 0,
  opts = {}
) {
  const {
    rectangleAreaRatio = 0.8,
    trimFraction = 0.1,
    outlierTolerance = 0.15,
  } = opts;

  if (!Array.isArray(points) || points.length < 3) return points;

  const c = Math.cos(orthoAngleRad);
  const s = Math.sin(orthoAngleRad);
  // Ortho frame basis — same convention as floodFillFromLoupe.getLoupeFrame:
  //   tangent = (cos θ, sin θ)   → u axis
  //   normal  = (-sin θ, cos θ)  → v axis
  const us = new Array(points.length);
  const vs = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    us[i] = points[i].x * c + points[i].y * s;
    vs[i] = -points[i].x * s + points[i].y * c;
  }

  // Polygon area (shoelace on raw (x, y); rotation preserves area).
  let twiceSigned = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    twiceSigned += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  const polygonArea = Math.abs(twiceSigned) / 2;
  if (polygonArea <= 0) return points;

  const fromUV = (u, v) => ({
    x: u * c - v * s,
    y: u * s + v * c,
  });
  const makeRect = (uMin, uMax, vMin, vMax) => [
    fromUV(uMin, vMin),
    fromUV(uMax, vMin),
    fromUV(uMax, vMax),
    fromUV(uMin, vMax),
  ];

  // ---------- PASS 1 — full ortho bbox ----------
  let uMin = Infinity,
    uMax = -Infinity,
    vMin = Infinity,
    vMax = -Infinity;
  for (let i = 0; i < us.length; i++) {
    if (us[i] < uMin) uMin = us[i];
    if (us[i] > uMax) uMax = us[i];
    if (vs[i] < vMin) vMin = vs[i];
    if (vs[i] > vMax) vMax = vs[i];
  }
  const fullArea = (uMax - uMin) * (vMax - vMin);
  if (fullArea <= 0) return points;

  const fullRatio = polygonArea / fullArea;
  if (fullRatio >= rectangleAreaRatio && fullRatio <= 1 + outlierTolerance) {
    return makeRect(uMin, uMax, vMin, vMax);
  }

  // ---------- PASS 2 — trim only the shorter axis ----------
  const uExt = uMax - uMin;
  const vExt = vMax - vMin;
  const trimV = uExt >= vExt; // shorter axis → trim there
  const values = (trimV ? vs : us).slice().sort((a, b) => a - b);
  const k = Math.floor(values.length * trimFraction);
  if (k <= 0) return points;
  const loTrim = values[k];
  const hiTrim = values[values.length - 1 - k];
  if (!Number.isFinite(loTrim) || !Number.isFinite(hiTrim) || hiTrim <= loTrim) {
    return points;
  }

  const uMinT = trimV ? uMin : loTrim;
  const uMaxT = trimV ? uMax : hiTrim;
  const vMinT = trimV ? loTrim : vMin;
  const vMaxT = trimV ? hiTrim : vMax;
  const trimmedArea = (uMaxT - uMinT) * (vMaxT - vMinT);
  if (trimmedArea <= 0) return points;

  const trimmedRatio = polygonArea / trimmedArea;
  if (
    trimmedRatio >= rectangleAreaRatio &&
    trimmedRatio <= 1 + outlierTolerance
  ) {
    return makeRect(uMinT, uMaxT, vMinT, vMaxT);
  }

  return points;
}
