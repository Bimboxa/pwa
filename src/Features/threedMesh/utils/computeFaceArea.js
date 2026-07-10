import computePlaneBasis from "./computePlaneBasis.js";
import { projectLoopTo2d } from "./planeProjection.js";

// Shoelace signed area of a 2D loop (open: last point ≠ first point).
export function signedArea2d(loop) {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % loop.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return sum / 2;
}

// Net area of a 2D polygon with holes.
export function polygonArea2d(contour, holes = []) {
  let area = Math.abs(signedArea2d(contour));
  for (const hole of holes) area -= Math.abs(signedArea2d(hole));
  return Math.max(0, area);
}

/**
 * Area (m²) of one planar face {contour: [{x,y,z}], holes, normal}.
 */
export default function computeFaceArea(face) {
  const contour = face?.contour;
  if (!contour || contour.length < 3) return 0;
  const basis = computePlaneBasis(face.normal, contour[0]);
  return polygonArea2d(
    projectLoopTo2d(contour, basis),
    (face.holes || []).map((hole) => projectLoopTo2d(hole, basis))
  );
}

// Total surface (m²) of a maille = sum of its face areas.
export function computeMesh3dSurface(faces) {
  return (faces || []).reduce((sum, face) => sum + computeFaceArea(face), 0);
}

// Shoelace centroid of a 2D loop (falls back to the vertex average for
// degenerate/zero-area loops).
export function polygonCentroid2d(loop) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % loop.length];
    const w = p.x * q.y - q.x * p.y;
    area += w;
    cx += (p.x + q.x) * w;
    cy += (p.y + q.y) * w;
  }
  if (Math.abs(area) < 1e-12) {
    const n = loop.length || 1;
    return {
      x: loop.reduce((s, p) => s + p.x, 0) / n,
      y: loop.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return { x: cx / (3 * area), y: cy / (3 * area) };
}
