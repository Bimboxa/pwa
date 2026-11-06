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

// Flat cross-section of `section`: [first, last], or null when the chord is
// degenerate (closed profile — a flat segment then sweeps nothing and the
// caps alone close the profiled ends). `keys` names the two section
// coordinates ({x, y} for the plan sweep, {u, w} for the 3D sweep).
export function getFlatSection(section, keys = ["x", "y"]) {
  if (!Array.isArray(section) || section.length < 2) return null;
  const [kx, ky] = keys;
  const first = section[0];
  const last = section[section.length - 1];
  if (Math.hypot(last[kx] - first[kx], last[ky] - first[ky]) < EPS) return null;
  return [first, last];
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
  const PL = pts[pts.length - 1];
  const dx = PL.x - P0.x;
  const dy = PL.y - P0.y;
  const chord = Math.hypot(dx, dy);

  let extent = 0;
  for (const p of pts) {
    extent = Math.max(extent, Math.hypot(p.x - P0.x, p.y - P0.y));
  }
  if (extent < EPS) return null;
  const tol = extent * 1e-9;
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
    const ux = dx / chord;
    const uy = dy / chord;
    // Signed distance to the chord line.
    const side = pts.map((p) => ux * (p.y - P0.y) - uy * (p.x - P0.x));
    let lobe = [{ x: P0.x, y: P0.y }];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const sa = side[i - 1];
      const sb = side[i];
      if (Math.abs(sa) > tol && Math.abs(sb) > tol && sa * sb < 0) {
        // Strict crossing: close the lobe on the chord line, open the next.
        const t = sa / (sa - sb);
        const X = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
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
