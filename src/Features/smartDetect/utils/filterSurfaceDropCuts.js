// Minimum cut side in source image pixels.
// Cuts whose bounding box is smaller than this in both dimensions
// are considered noise (dots, small artifacts).
const MIN_CUT_SIDE_PX = 8;

// Maximum vertex density: points per unit of bbox perimeter (in pixels).
// Architectural openings (rectangles, circles) have few vertices spread
// along their perimeter. Text and noise have many vertices packed tightly.
// Rectangle 4pts on ~40px perimeter = 0.1, circle ~8pts on ~60px = 0.13
// Letter "S" ~20pts on ~40px perimeter = 0.5
const MAX_DENSITY_PER_PX = 0.2;

export default function filterSurfaceDropCuts(
  cuts,
  { noCuts, noSmallCuts, baseMapImageScale }
) {
  if (!cuts || cuts.length === 0) return undefined;
  if (noCuts) return undefined;

  if (!noSmallCuts) return cuts;

  const scale = baseMapImageScale || 1;
  const minSide = MIN_CUT_SIDE_PX * scale;
  const minArea = minSide * minSide;

  const filtered = cuts.filter((cut) => {
    const pts = cut.points;
    if (!pts || pts.length < 3) return false;

    // Compute bounding box
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;

    // Filter by bounding box area (too small = noise)
    if (bboxW * bboxH < minArea) return false;

    // Filter by point density: too many points packed into the perimeter = noise
    const perimeterPx = 2 * (bboxW + bboxH) / scale;
    const density = pts.length / perimeterPx;
    if (density > MAX_DENSITY_PER_PX) return false;

    return true;
  });

  return filtered.length > 0 ? filtered : undefined;
}
