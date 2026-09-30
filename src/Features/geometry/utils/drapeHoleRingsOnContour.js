import { Vector2, ShapeUtils } from "three";

import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";

// Drape the hole rings (POLYGON cuts) of a sloped polygon onto the top / bottom
// surfaces defined by the OUTER contour alone.
//
// Why: the top face is triangulated over [contour, ...holes] and every vertex
// is lifted to its own offsetBottom / offsetTop. Cut vertices are created
// without offsets (0), so a ramp polygon (per-vertex offsetTop) gets pulled
// down to the base height around every cut — a crater instead of a hole in
// the ramp. The wanted result is "the shape without holes, holes carved
// afterwards": the sheet keeps its slope and the hole walls become vertical
// cliffs from the bottom face up to the sheet.
//
// Rule: a hole ring whose vertices ALL carry zero offsetBottom AND zero
// offsetTop takes, per vertex, the offsets interpolated on the earcut
// triangulation of the contour alone (barycentric inside the containing
// triangle — exactly the surface rendered when the polygon has no cut, same
// triangulator, same diagonals). A ring carrying at least one authored
// non-zero offset is returned unchanged (the user can set offsets on cut
// vertices). Both offsets are interpolated separately: the interpolation is
// linear, so top = interp(offsetBottom) + interp(offsetTop) stays on the
// no-hole top sheet, and the bottom face follows a sloped offsetBottom too.
//
// Fallback when no contour triangle contains a vertex (degenerate contour,
// vertex numerically outside): nearest contour segment + linear lerp of the
// two offsets (same rule as getAnnotationHeightAtPoint for lines).
//
// Inputs are arc-expanded rings ({x, y, offsetBottom?, offsetTop?}) in any
// consistent unit; both windings are accepted. Input point objects are never
// mutated. Returns the same `holes` array reference when nothing changes
// (no contour offsets, no holes); untouched rings keep their reference.
//
// Known limit: with a NON-planar contour surface (5+ vertices with arbitrary
// offsets) the earcut with holes then builds different triangles between the
// rim and the contour, so the rim-to-contour band is a slightly different
// piecewise-linear surface than the no-hole render. For a planar ramp (the
// common case) the result is exact.

const OFFSET_EPS = 1e-9;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ringHasOffsets(ring) {
  return (ring || []).some(
    (p) =>
      Math.abs(num(p?.offsetBottom)) > OFFSET_EPS ||
      Math.abs(num(p?.offsetTop)) > OFFSET_EPS
  );
}

function triangulateContour(contour) {
  try {
    const v2 = contour.map((p) => new Vector2(p.x, p.y));
    return ShapeUtils.triangulateShape(v2, []) || [];
  } catch {
    return [];
  }
}

// Barycentric weights of p in triangle (a, b, c), or null when p lies outside
// (inclusive test with a relative epsilon so rim vertices sitting exactly on
// an earcut diagonal are still accepted). Works for both windings.
function barycentric(p, a, b, c) {
  const area2 = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (Math.abs(area2) < 1e-18) return null;
  const wa = ((b.x - p.x) * (c.y - p.y) - (c.x - p.x) * (b.y - p.y)) / area2;
  const wb = ((c.x - p.x) * (a.y - p.y) - (a.x - p.x) * (c.y - p.y)) / area2;
  const wc = 1 - wa - wb;
  const eps = 1e-9;
  if (wa < -eps || wb < -eps || wc < -eps) return null;
  return [wa, wb, wc];
}

function interpolateInTriangles(tris, contour, p, key) {
  for (const [ia, ib, ic] of tris) {
    const a = contour[ia];
    const b = contour[ib];
    const c = contour[ic];
    const w = barycentric(p, a, b, c);
    if (!w) continue;
    return w[0] * num(a[key]) + w[1] * num(b[key]) + w[2] * num(c[key]);
  }
  return null;
}

function interpolateOnContourSegments(contour, p, key) {
  const n = contour.length;
  let best = null;
  for (let i = 0; i < n; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % n];
    const proj = projectPointOnSegment(p, a, b);
    if (!best || proj.distance < best.distance) best = { ...proj, a, b };
  }
  if (!best) return 0;
  return num(best.a[key]) + best.t * (num(best.b[key]) - num(best.a[key]));
}

export default function drapeHoleRingsOnContour(contour, holes) {
  if (!Array.isArray(holes) || holes.length === 0) return holes;
  if (!Array.isArray(contour) || contour.length < 3) return holes;
  if (!ringHasOffsets(contour)) return holes;

  const tris = triangulateContour(contour);
  const sample = (p, key) => {
    const v = tris.length
      ? interpolateInTriangles(tris, contour, p, key)
      : null;
    return v ?? interpolateOnContourSegments(contour, p, key);
  };

  let changed = false;
  const draped = holes.map((ring) => {
    if (!Array.isArray(ring) || ring.length < 3) return ring;
    if (ringHasOffsets(ring)) return ring; // authored offsets win
    changed = true;
    return ring.map((p) => ({
      ...p,
      offsetBottom: sample(p, "offsetBottom"),
      offsetTop: sample(p, "offsetTop"),
    }));
  });
  return changed ? draped : holes;
}
