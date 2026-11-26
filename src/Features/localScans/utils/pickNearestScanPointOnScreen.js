// Nearest point (smallest depth along the ray) of a cloud drawn within
// `radiusPx` of a screen point. Synchronous counterpart of the screen pick
// of pickLocalScanPoint, without the plane fit: one pass, no allocation, so
// the camera pivot can be resolved on the pointerdown itself. Source
// coordinates throughout.
//
// query: {
//   matrix   projection × view × cloud world matrix (column-major, 16),
//   ndc      [x, y] of the screen point, width / height the canvas size (px),
//   origin, direction   the pointer ray (unit direction),
//   radiusPx (default 6),
//   step     read one point out of `step` (default 1),
//   slice    {row, lower, upper} height slice shown (see pickLocalScanPoint),
//   planes   [[nx, ny, nz, constant]] clipping planes: a point is kept
//            while n · p + constant >= 0,
// }
// → {point: [x, y, z], depth} | null
export default function pickNearestScanPointOnScreen(positions, query) {
  const { matrix: m, ndc, width, height, origin, direction } = query;
  const radiusPx = query.radiusPx ?? 6;
  const radius2 = radiusPx * radiusPx;
  const stride = 3 * Math.max(1, Math.floor(query.step ?? 1));
  const slice = query.slice ?? null;
  const planes = query.planes ?? [];
  const halfWidth = width / 2,
    halfHeight = height / 2;
  let best = -1;
  let nearest = Infinity;
  points: for (let i = 0; i + 2 < positions.length; i += stride) {
    const x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    const depth =
      (x - origin[0]) * direction[0] +
      (y - origin[1]) * direction[1] +
      (z - origin[2]) * direction[2];
    if (depth <= 0 || depth >= nearest) continue;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0) continue;
    const dx =
      ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w - ndc[0]) * halfWidth;
    if (dx > radiusPx || dx < -radiusPx) continue;
    const dy =
      ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w - ndc[1]) * halfHeight;
    if (dx * dx + dy * dy > radius2) continue;
    const clipZ = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    if (clipZ < -1 || clipZ > 1) continue;
    if (slice) {
      const { row, lower, upper } = slice;
      const level = row[0] * x + row[1] * y + row[2] * z + row[3];
      if (level < lower || level > upper) continue;
    }
    for (const plane of planes)
      if (plane[0] * x + plane[1] * y + plane[2] * z + plane[3] < 0)
        continue points;
    nearest = depth;
    best = i;
  }
  if (best < 0) return null;
  return {
    point: [positions[best], positions[best + 1], positions[best + 2]],
    depth: nearest,
  };
}
