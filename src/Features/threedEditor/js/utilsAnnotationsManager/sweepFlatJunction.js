import { ShapeUtils, Vector2 } from "three";

// "Extrusion plate" helpers shared by the plan sweep (sweepGeometry.js) and
// the 3D sweep (sweepGeometry3d.js) of a POLYLINE carrying an inline profile.
//
// On a guide segment flagged flat (annotation.isFlatExtrusionSegmentsIdx) the
// swept cross-section collapses to its CHORD: first → last section point. Both
// borders of the sheet therefore stay continuous along the guide, and the hole
// left at a profiled ↔ flat joint is exactly the profile closed by its chord —
// the junction cap built here, in section coordinates, once per sweep.
//
// No app imports — node-testable (sweepFlatJunction.test.mjs).

const EPS = 1e-9;
// A profile point closer to the chord line than this × the profile extent
// counts as ON the chord (0.1 mm per metre: far below the 1° fold the edge
// lines are drawn at, so a hand-drawn lip still merges with the flat sheet).
const ON_CHORD_TOL = 1e-4;

// Chord frame of a section [{x, y}]: unit direction, per-point signed
// distance to the chord line (`side`) and abscissa along it (`along`).
// Shared by getFlatSection and buildJunctionCap so both read the profile ↔
// chord contacts identically.
function getChordFrame(pts) {
  const P0 = pts[0];
  const PL = pts[pts.length - 1];
  const dx = PL.x - P0.x;
  const dy = PL.y - P0.y;
  const chord = Math.hypot(dx, dy);
  let extent = 0;
  for (const p of pts) {
    extent = Math.max(extent, Math.hypot(p.x - P0.x, p.y - P0.y));
  }
  const ux = chord > EPS ? dx / chord : 0;
  const uy = chord > EPS ? dy / chord : 0;
  return {
    chord,
    extent,
    tol: extent * ON_CHORD_TOL,
    side: pts.map((p) => ux * (p.y - P0.y) - uy * (p.x - P0.x)),
    along: pts.map((p) => ux * (p.x - P0.x) + uy * (p.y - P0.y)),
  };
}

// Point where the profile edge a → b strictly crosses the chord line (signed
// distances sa, sb of opposite signs).
function getChordCrossing(a, b, sa, sb) {
  const t = sa / (sa - sb);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

const isStrictCrossing = (sa, sb, tol) =>
  Math.abs(sa) > tol && Math.abs(sb) > tol && sa * sb < 0;

// Flat cross-section of `section`: its first → last chord, SUBDIVIDED at
// every point where the profile meets it (profile vertices lying on the
// chord, and the points where the profile crosses it). The flat sheet then
// has, at a profiled ↔ flat joint, the very edges of the profile parts lying
// on the chord and of the junction cap: no T-junction, hence no edge line
// between two coplanar faces (EdgesGeometry only pairs identical edges).
//
// Returns null when the chord is degenerate (closed profile — a flat segment
// then sweeps nothing and the caps alone close the profiled ends). `keys`
// names the two section coordinates ({x, y} for the plan sweep, {u, w} for
// the 3D sweep); profile vertices are returned as is.
export function getFlatSection(section, keys = ["x", "y"]) {
  if (!Array.isArray(section) || section.length < 2) return null;
  const [kx, ky] = keys;
  const pts = section.map((c) => ({ x: c[kx], y: c[ky] }));
  const { chord, tol, side, along } = getChordFrame(pts);
  if (chord < EPS) return null;

  // Contacts strictly inside the chord, by abscissa.
  const contacts = [];
  for (let i = 1; i < pts.length; i += 1) {
    if (isStrictCrossing(side[i - 1], side[i], tol)) {
      const X = getChordCrossing(pts[i - 1], pts[i], side[i - 1], side[i]);
      const t =
        along[i - 1] +
        ((along[i] - along[i - 1]) * side[i - 1]) / (side[i - 1] - side[i]);
      contacts.push({ t, point: { [kx]: X.x, [ky]: X.y } });
    }
    if (i < pts.length - 1 && Math.abs(side[i]) <= tol) {
      contacts.push({ t: along[i], point: section[i] });
    }
  }
  contacts.sort((a, b) => a.t - b.t);

  const out = [section[0]];
  let lastT = 0;
  for (const { t, point } of contacts) {
    if (t <= lastT + tol || t >= chord - tol) continue;
    out.push(point);
    lastT = t;
  }
  out.push(section[section.length - 1]);
  return out;
}

const signedArea = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
};

// Junction cap of a section given as [{x, y}] (open chain): the region between
// the profile and its first → last chord.
//
// The chain is split wherever it meets the chord LINE, so a profile folding
// across its chord (Z shape) yields one simple lobe per side instead of a
// self-intersecting polygon; each lobe is triangulated on its own. A closed
// profile (degenerate chord) is one polygon.
//
// Returns { points: [{x, y}], triangles: number[] } (triangles index
// `points`), or null when there is nothing to close (straight profile).
export function buildJunctionCap(section) {
  const pts = (section || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (pts.length < 3) return null;

  const P0 = pts[0];
  const { chord, extent, tol, side } = getChordFrame(pts);
  if (extent < EPS) return null;
  const minArea = extent * extent * 1e-12;

  const lobes = [];
  const flush = (lobe) => {
    if (lobe.length >= 3 && Math.abs(signedArea(lobe)) > minArea) {
      lobes.push(lobe);
    }
  };

  if (chord < EPS) {
    // Closed profile: the whole ring (closing duplicate dropped).
    flush(pts.slice(0, -1));
  } else {
    let lobe = [{ x: P0.x, y: P0.y }];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const sa = side[i - 1];
      const sb = side[i];
      if (isStrictCrossing(sa, sb, tol)) {
        // Strict crossing: close the lobe on the chord line, open the next.
        const X = getChordCrossing(a, b, sa, sb);
        lobe.push(X);
        flush(lobe);
        lobe = [{ x: X.x, y: X.y }];
      }
      lobe.push({ x: b.x, y: b.y });
      if (Math.abs(sb) <= tol) {
        flush(lobe);
        lobe = [{ x: b.x, y: b.y }];
      }
    }
  }

  if (lobes.length === 0) return null;

  const points = [];
  const triangles = [];
  for (const lobe of lobes) {
    const base = points.length;
    const faces = ShapeUtils.triangulateShape(
      lobe.map((p) => new Vector2(p.x, p.y)),
      []
    );
    if (!faces.length) continue;
    for (const p of lobe) points.push(p);
    for (const [a, b, c] of faces) triangles.push(base + a, base + b, base + c);
  }
  return triangles.length ? { points, triangles } : null;
}
