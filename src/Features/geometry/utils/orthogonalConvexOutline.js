// Orthogonal convex outline of a point cloud: a rectilinear staircase that wraps
// all points, hugging the extreme points, with NO inward notches (convex). The
// upper & lower boundaries are unimodal in y; left & right edges close the loop.
//
// Every returned corner is one of the input coordinates OR a step corner. When
// `isExisting(x, y)` is provided, a diagonal step that cannot be turned into an
// L-corner landing on an existing point is emitted as a single diagonal segment
// instead — so the caller can keep using existing points only (no new points).
//
// points: [{ x, y, ... }] -> { loop: [{x, y}], top, bottom }

function uniqByXY(points) {
  const seen = new Set();
  const out = [];
  for (const p of points) {
    if (p == null || p.x == null || p.y == null) continue;
    const k = p.x + "," + p.y;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

// upper staircase chain (left -> right), unimodal in y (hug the top)
function upperChain(points) {
  let top = points[0];
  for (const p of points)
    if (p.y < top.y || (p.y === top.y && p.x < top.x)) top = p;

  const left = points
    .filter((p) => p.x <= top.x)
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const l = [];
  let m = Infinity;
  for (const p of left) if (p.y < m - 1e-9) { m = p.y; l.push(p); }

  const right = points
    .filter((p) => p.x >= top.x)
    .sort((a, b) => b.x - a.x || a.y - b.y);
  const r = [];
  m = Infinity;
  for (const p of right) if (p.y < m - 1e-9) { m = p.y; r.push(p); }
  r.reverse();

  return l.concat(r.filter((p) => !(p.x === top.x && p.y === top.y)));
}

// lower staircase chain (left -> right), unimodal in y (hug the bottom)
function lowerChain(points) {
  let bot = points[0];
  for (const p of points)
    if (p.y > bot.y || (p.y === bot.y && p.x < bot.x)) bot = p;

  const left = points
    .filter((p) => p.x <= bot.x)
    .sort((a, b) => a.x - b.x || b.y - a.y);
  const l = [];
  let m = -Infinity;
  for (const p of left) if (p.y > m + 1e-9) { m = p.y; l.push(p); }

  const right = points
    .filter((p) => p.x >= bot.x)
    .sort((a, b) => b.x - a.x || b.y - a.y);
  const r = [];
  m = -Infinity;
  for (const p of right) if (p.y > m + 1e-9) { m = p.y; r.push(p); }
  r.reverse();

  return l.concat(r.filter((p) => !(p.x === bot.x && p.y === bot.y)));
}

// expand a chain into rectilinear corners. Each diagonal step gets an L-corner
// ((x2,y1) or (x1,y2)) only if it lands on an existing point; otherwise the step
// stays diagonal (no new point is invented).
function toStaircase(chain, isExisting) {
  const out = [];
  if (!chain.length) return out;
  out.push({ x: chain[0].x, y: chain[0].y });
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1];
    const b = chain[i];
    if (Math.abs(a.x - b.x) > 1e-9 && Math.abs(a.y - b.y) > 1e-9) {
      const c1 = { x: b.x, y: a.y };
      const c2 = { x: a.x, y: b.y };
      if (isExisting && isExisting(c1.x, c1.y)) out.push(c1);
      else if (isExisting && isExisting(c2.x, c2.y)) out.push(c2);
      // else: leave as a diagonal a -> b
    }
    out.push({ x: b.x, y: b.y });
  }
  return out;
}

export default function orthogonalConvexOutline(rawPoints, isExisting) {
  const points = uniqByXY(rawPoints);
  if (points.length < 3) return { loop: points.slice(), top: [], bottom: [] };

  const up = toStaircase(upperChain(points), isExisting);
  const lo = toStaircase(lowerChain(points), isExisting);

  // closed loop: top (L->R) + bottom (R->L); the right & left edges close via wrap
  const loop = [...up, ...lo.slice().reverse()];
  return { loop, top: up, bottom: lo };
}
