import getAnnotationVertices from "Features/annotations/utils/getAnnotationVertices";

// Classify the repair to perform on the concerned annotations.
//
// Returns one of "L" | "T" | "SMOOTH".
//
// - "SMOOTH": a single concerned annotation → simplified/smoothed in place,
//   EXCEPT a single self-intersecting closed outline, which buildRepairProposal
//   instead UNTANGLES into its constituent loops and SPLITS into separate
//   annotations.
// - "T": an endpoint of one polyline lands on the BODY of another (best-effort,
//   mirrors insertWallJunctionPoints' T test).
// - "L": two (or more) concerned polylines meeting near their endpoints.
//
// The L vs T distinction is informational: two or more concerned closed outlines
// are joined tip-vs-flank by the projection splice in buildRepairProposal.
// `forcedType` (from the DrawingHelper override) short-circuits auto-detection.

function projectOntoSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { t: 0, dist: Math.hypot(px - ax, py - ay) };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return { t, dist: Math.hypot(px - projX, py - projY) };
}

function bboxDiag(verts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of verts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

// Best-effort: is there a T junction (an endpoint on another polyline's body)?
function hasTJunction(annotationsVerts, tol) {
  for (let i = 0; i < annotationsVerts.length; i++) {
    const vA = annotationsVerts[i];
    if (vA.length < 2) continue;
    const endpoints = [vA[0], vA[vA.length - 1]];
    for (const ep of endpoints) {
      for (let j = 0; j < annotationsVerts.length; j++) {
        if (j === i) continue;
        const vB = annotationsVerts[j];
        for (let k = 0; k < vB.length - 1; k++) {
          const proj = projectOntoSegment(
            ep.x,
            ep.y,
            vB[k].x,
            vB[k].y,
            vB[k + 1].x,
            vB[k + 1].y
          );
          if (proj.dist <= tol && proj.t > 0.05 && proj.t < 0.95) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export default function classifyRepairType(annotations, { forcedType } = {}) {
  if (forcedType && forcedType !== "AUTO") return forcedType;

  if (!Array.isArray(annotations) || annotations.length < 2) {
    return "SMOOTH";
  }

  const annotationsVerts = annotations.map((a) => getAnnotationVertices(a));
  const maxDiag = annotationsVerts.reduce(
    (m, v) => Math.max(m, bboxDiag(v)),
    0
  );
  // Junction proximity tolerance scaled to the selection scale; floor at 8 px.
  const tol = Math.max(8, maxDiag * 0.25);

  return hasTJunction(annotationsVerts, tol) ? "T" : "L";
}
