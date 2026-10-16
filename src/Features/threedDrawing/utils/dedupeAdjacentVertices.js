const POINT_DEDUPE_EPS = 5e-4; // 0.05% of normalized space
const OFFSET_DEDUPE_EPS_M = 5e-3; // 5 mm

// Two projected vertices are the same vertex when they share the plan
// position AND the altitude. Same plan position at another altitude is a
// vertical segment (a riser drawn in 3D): it is kept, and insertOrReusePoints
// then gives both refs the same db.points id, so a 2D drag keeps it vertical.
function isSameVertex(a, b) {
  return (
    Math.abs(a.x - b.x) < POINT_DEDUPE_EPS &&
    Math.abs(a.y - b.y) < POINT_DEDUPE_EPS &&
    Math.abs((a.offsetBottom ?? 0) - (b.offsetBottom ?? 0)) <
      OFFSET_DEDUPE_EPS_M
  );
}

// Drop consecutive duplicates of a projected polyline ({x, y, offsetBottom}
// in normalized baseMap space, offsets in meters).
export default function dedupeAdjacentVertices(
  points,
  { collapseClosingDuplicate } = {}
) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && isSameVertex(last, p)) continue;
    out.push(p);
  }
  // An OPEN polyline may legitimately end near its start — only collapse the
  // last==first duplicate when the line is explicitly closed.
  if (
    collapseClosingDuplicate &&
    out.length > 1 &&
    isSameVertex(out[0], out[out.length - 1])
  ) {
    out.pop();
  }
  return out;
}
