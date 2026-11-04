import pointInPolygon2d from "./pointInPolygon2d.js";

// A crossing interval shorter than this (m) is a vertex the line only
// touches — no chord (same as computeFaceAxisCut).
const MIN_CHORD = 1e-6;

// Two runs closer than this (m) are one: a zero-width slit left by a boolean
// union along a shared edge must not stop a chord.
const SLIT_TOLERANCE = 1e-5;

// Chord of a 2D polygon with holes through `point`, along an axis: "H" (the
// horizontal line y = point.y, abscissas along x) or "V" (x = point.x,
// abscissas along y). The crossing logic of computeFaceAxisCut (half-open
// rule so a vertex on the line counts once, runs validated by their middle
// inside the contour and outside the holes), without snap nor reference.
//
// loops2d: [contour, ...holes], open loops of {x, y}.
// Returns { lo, hi } — the run holding the point — or null when the point is
// not inside the polygon along that line. Pure, node-testable.
export function chordThroughPoint(loops2d, point, axis) {
  const contour = loops2d?.[0];
  if (!contour || contour.length < 3 || !point) return null;
  const isH = axis === "H";
  const coord = isH ? "y" : "x";
  const along = isH ? "x" : "y";
  const cut = point[coord];

  const crossings = [];
  for (const loop of loops2d) {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % n];
      if (a[coord] > cut === b[coord] > cut) continue;
      const t = (cut - a[coord]) / (b[coord] - a[coord]);
      crossings.push(a[along] + t * (b[along] - a[along]));
    }
  }
  crossings.sort((p, q) => p - q);

  const [, ...holes] = loops2d;
  const runs = [];
  for (let i = 0; i + 1 < crossings.length; i++) {
    const lo = crossings[i];
    const hi = crossings[i + 1];
    if (hi - lo < MIN_CHORD) continue;
    const mid = { [coord]: cut, [along]: (lo + hi) / 2 };
    if (!pointInPolygon2d(mid, contour)) continue;
    if (holes.some((hole) => pointInPolygon2d(mid, hole))) continue;
    const last = runs[runs.length - 1];
    if (last && lo - last.hi < SLIT_TOLERANCE) last.hi = hi;
    else runs.push({ lo, hi });
  }

  const at = point[along];
  return runs.find((run) => at >= run.lo - 1e-9 && at <= run.hi + 1e-9) ?? null;
}
