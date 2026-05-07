import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

// Among the candidate baseMaps, pick the one whose 2D footprint best
// "contains" the face. We project the face centroid onto each baseMap;
// the winner is the one with the smallest out-of-bounds distance, with a
// |offset| tiebreaker (face closer to the baseMap plane wins).
export default function pickHostBaseMap(faceVertices, baseMaps) {
  if (!faceVertices?.length || !baseMaps?.length) return null;

  const cx = faceVertices.reduce((s, v) => s + v.x, 0) / faceVertices.length;
  const cy = faceVertices.reduce((s, v) => s + v.y, 0) / faceVertices.length;
  const cz = faceVertices.reduce((s, v) => s + v.z, 0) / faceVertices.length;
  const centroid = { x: cx, y: cy, z: cz };

  let best = null;
  let bestScore = Infinity;
  let bestAbsOffset = Infinity;

  for (const baseMap of baseMaps) {
    const projected = worldToBaseMapNormalized(centroid, baseMap);
    if (!projected) continue;

    const outX = Math.max(0, projected.x - 1, -projected.x);
    const outY = Math.max(0, projected.y - 1, -projected.y);
    const score = Math.max(outX, outY);
    const absOffset = Math.abs(projected.offset);

    if (
      score < bestScore - 1e-6 ||
      (Math.abs(score - bestScore) < 1e-6 && absOffset < bestAbsOffset)
    ) {
      best = baseMap;
      bestScore = score;
      bestAbsOffset = absOffset;
    }
  }

  return best;
}
