/**
 * mergeDetectedPolyIntoDrawing
 *
 * Merges a detected ORTHO_PATHS polyline into the current drawingPoints array.
 * The detected polyline is orthogonal (H/V segments only) and passes through A'
 * (the BFS start point, snapped to the median line of the dark band near the click).
 *
 * See mergeDetectedPolyIntoDrawing.md for full documentation.
 *
 * @param {Array<{x:number, y:number}>} drawingPoints - Current drawing points (last = click point)
 * @param {Array<{x:number, y:number}>} detectedPolyRaw - Detected polyline from BFS worker
 * @returns {Array<{x:number, y:number}>} Merged drawing points
 */
export default function mergeDetectedPolyIntoDrawing(drawingPoints, detectedPolyRaw) {
  const clickPt = drawingPoints[drawingPoints.length - 1];

  // --- Find A' (point in detected poly closest to click) ---
  let splitIdx = 0;
  let minD = Infinity;
  for (let i = 0; i < detectedPolyRaw.length; i++) {
    const d = Math.hypot(detectedPolyRaw[i].x - clickPt.x, detectedPolyRaw[i].y - clickPt.y);
    if (d < minD) { minD = d; splitIdx = i; }
  }

  // --- Split into two arms from A' (each walks AWAY from A') ---
  const arm1 = detectedPolyRaw.slice(0, splitIdx + 1).reverse(); // A' → poly start
  const arm2 = detectedPolyRaw.slice(splitIdx);                   // A' → poly end

  // ===== CASE 1: First point — orient full poly by longest arm =====
  if (drawingPoints.length <= 1) {
    const len1 = polylineLength(arm1);
    const len2 = polylineLength(arm2);
    // Longest arm goes last (= drawing tip)
    // Result: [shortEnd → ... → A' → ... → longEnd]
    if (len1 > len2) {
      return [...arm2.reverse(), ...arm1.slice(1)];
    } else {
      return [...arm1.reverse(), ...arm2.slice(1)];
    }
  }

  // ===== CASE 2: Extending — keep all prevPoints, append forward arm =====
  const prevPoints = drawingPoints.slice(0, -1); // all points before the click — NEVER modified

  // Pick forward arm: the one whose end is farther from prevPoints[-1]
  // (= the arm going AWAY from the existing drawing, parallel or perpendicular)
  const prevEnd = prevPoints[prevPoints.length - 1];
  const end1Dist = arm1.length > 0
    ? Math.hypot(arm1[arm1.length - 1].x - prevEnd.x, arm1[arm1.length - 1].y - prevEnd.y)
    : 0;
  const end2Dist = arm2.length > 0
    ? Math.hypot(arm2[arm2.length - 1].x - prevEnd.x, arm2[arm2.length - 1].y - prevEnd.y)
    : 0;
  const forwardArm = end1Dist >= end2Dist ? arm1 : arm2;

  if (forwardArm.length === 0) return drawingPoints;

  // Append: prevPoints (untouched) + forward arm (starts with A', replaces clickPt)
  return [...prevPoints, ...forwardArm];
}

// --- Internal helpers ---

/** Sum of Euclidean distances along a polyline. */
function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}
