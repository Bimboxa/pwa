// Center of the bounding box of normalized points ({x, y} in [0..1]).
// Returns null when no point carries finite coordinates.
export default function getNormalizedPointsCenter(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points ?? []) {
    const x = point?.x;
    const y = point?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (minX === Infinity) return null;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
