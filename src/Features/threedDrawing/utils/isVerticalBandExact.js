// Plan-position bucket (normalized [0..1] space) of the band posts — same
// tolerance as buildVerticalBandPoints.
const PLAN_KEY_EPS = 5e-4;

// Tolerance (m) on the bottom / top of the band.
const Z_TOL_M = 0.01;

// Whether the vertical band encoding (buildVerticalBandPoints: one post per
// plan position carrying the [min, max] z interval of the corners there,
// bottom and top interpolated linearly between posts) reproduces the drawn
// vertical face exactly. A triangle, a rectangle or a sloped wall top does; an
// L, a U or a gable whose apex has no corner below it does not — the band
// would fill a different shape.
//
// Both outlines are linear between two consecutive posts (every corner sits
// on a post), so comparing them at two points of each span is enough.
//
// projected: classification.projected — the face cycle as [{x, y, offset}]
// (normalized plan position, offset in meters), unrounded.
export default function isVerticalBandExact(
  projected,
  { tolerance = Z_TOL_M } = {}
) {
  if (!projected || projected.length < 3) return false;

  const keyOf = (p) =>
    `${Math.round(p.x / PLAN_KEY_EPS)}_${Math.round(p.y / PLAN_KEY_EPS)}`;
  const postsByKey = new Map();
  for (const p of projected) {
    const key = keyOf(p);
    const post = postsByKey.get(key);
    if (!post) {
      postsByKey.set(key, { x: p.x, y: p.y, zMin: p.offset, zMax: p.offset });
    } else {
      post.zMin = Math.min(post.zMin, p.offset);
      post.zMax = Math.max(post.zMax, p.offset);
    }
  }
  const posts = [...postsByKey.values()];
  if (posts.length < 2) return false;

  // Footprint direction: the farthest pair of posts.
  let p0 = posts[0];
  let p1 = posts[1];
  let best = -1;
  for (const a of posts) {
    for (const b of posts) {
      const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      if (d > best) {
        best = d;
        p0 = a;
        p1 = b;
      }
    }
  }
  const dirX = p1.x - p0.x;
  const dirY = p1.y - p0.y;
  const len2 = dirX * dirX + dirY * dirY;
  if (len2 <= 0) return false;
  for (const post of posts) {
    post.along = ((post.x - p0.x) * dirX + (post.y - p0.y) * dirY) / len2;
  }
  posts.sort((a, b) => a.along - b.along);

  // The drawn face in (along, z), each corner on its post.
  const ring = projected.map((p) => ({
    along: postsByKey.get(keyOf(p)).along,
    z: p.offset,
  }));

  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const b = posts[i + 1];
    if (b.along - a.along < 1e-9) continue;
    for (const t of [1 / 3, 2 / 3]) {
      const s = a.along + t * (b.along - a.along);
      const crossings = [];
      for (let k = 0; k < ring.length; k++) {
        const u = ring[k];
        const v = ring[(k + 1) % ring.length];
        if ((u.along < s && v.along > s) || (v.along < s && u.along > s)) {
          crossings.push(
            u.z + ((s - u.along) / (v.along - u.along)) * (v.z - u.z)
          );
        }
      }
      // One interval: the face is a band there.
      if (crossings.length !== 2) return false;
      const [low, high] = crossings.sort((m, n) => m - n);
      const bandLow = a.zMin + t * (b.zMin - a.zMin);
      const bandHigh = a.zMax + t * (b.zMax - a.zMax);
      if (Math.abs(low - bandLow) > tolerance) return false;
      if (Math.abs(high - bandHigh) > tolerance) return false;
    }
  }
  return true;
}
