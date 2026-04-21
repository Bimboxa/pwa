/**
 * Convert a POLYLINE centerline + stroke width into the closed contour
 * polygon that exactly matches the polyline's rendered extent.
 *
 * Uses the same symmetric-offset algorithm as the "Contours" tool
 * (`useWallBoundaries.js`): offset the centerline by `+halfWidth` on one
 * side, by `-halfWidth` on the other, then concatenate the two into a
 * closed ring. Miter joins at intermediate vertices keep sharp corners
 * intact; segments are extended at the endpoints with butt caps (no
 * overshoot), matching Canvas's default `lineCap = 'butt'` that Konva
 * uses to render POLYLINE annotations.
 *
 * @param {Array<{x, y}>} points           Centerline points (≥ 2).
 * @param {number} strokeWidthPx           Full stroke width in the same
 *                                         coordinate space as `points`.
 * @returns {Array<{x, y}>}                Closed contour polygon (last
 *                                         point may equal the first).
 *                                         Empty if degenerate input.
 */
export default function getPolylineContourPoints(points, strokeWidthPx) {
  if (!points || points.length < 2) return [];
  if (!Number.isFinite(strokeWidthPx) || strokeWidthPx <= 0) return [];
  const halfWidth = strokeWidthPx / 2;

  const left = computeOffsetPolyline(points, halfWidth);
  const right = computeOffsetPolyline(points, -halfWidth);
  if (left.length < 2 || right.length < 2) return [];

  const ring = [];
  for (const p of left) ring.push({ x: p.x, y: p.y });
  for (let i = right.length - 1; i >= 0; i--) {
    ring.push({ x: right[i].x, y: right[i].y });
  }
  // Close explicitly so consumers that do `ctx.closePath()` are safe.
  ring.push({ x: left[0].x, y: left[0].y });
  return ring;
}

/**
 * Offset a polyline by `distance` (positive = left of direction of travel).
 * Uses miter joins at intermediate vertices; degenerate zero-length
 * segments are skipped.
 */
function computeOffsetPolyline(path, distance) {
  const n = path.length;
  if (n < 2) return [];

  const lines = [];
  for (let i = 0; i < n - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    lines.push({
      p: { x: a.x + nx * distance, y: a.y + ny * distance },
      v: { x: ux, y: uy },
      len,
    });
  }
  if (lines.length === 0) return [];

  const result = [{ ...lines[0].p }];
  for (let i = 1; i < lines.length; i++) {
    const inter = lineLineIntersection(
      lines[i - 1].p,
      lines[i - 1].v,
      lines[i].p,
      lines[i].v
    );
    result.push(inter ? { ...inter } : { ...lines[i].p });
  }
  const last = lines[lines.length - 1];
  result.push({
    x: last.p.x + last.v.x * last.len,
    y: last.p.y + last.v.y * last.len,
  });

  return result;
}

function lineLineIntersection(p1, v1, p2, v2) {
  const cross = v1.x * v2.y - v1.y * v2.x;
  if (Math.abs(cross) < 1e-8) return null;
  const t = ((p2.x - p1.x) * v2.y - (p2.y - p1.y) * v2.x) / cross;
  return { x: p1.x + t * v1.x, y: p1.y + t * v1.y };
}
