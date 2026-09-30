import computePlaneBasis from "../../threedMesh/utils/computePlaneBasis.js";
import pointInPolygon2d from "../../threedMesh/utils/pointInPolygon2d.js";
import { projectPointTo2d } from "../../threedMesh/utils/planeProjection.js";

import { ON_BOUNDARY_TOL_M } from "./mesh3dConstants.js";
import { getFaceLoops, getFaceNormal } from "./mesh3dTopology.js";

// 2D view of a mesh face in its own plane: basis + loops projected to (u, v).
// The basis is right-handed with the face normal, so a CCW contour has a
// positive signed area.
export function getFace2d(vertices, face) {
  const basis = computePlaneBasis(
    getFaceNormal(vertices, face),
    vertices[face.loop[0]]
  );
  const loops = getFaceLoops(face).map((loop) =>
    loop.map((vi) => projectPointTo2d(vertices[vi], basis))
  );
  return { basis, loops };
}

// Nearest boundary feature of a face to a 2D point: an existing vertex
// (within tolerance) wins over the edge it belongs to.
export function locateOnFaceBoundary(
  face2d,
  face,
  p,
  tolerance = ON_BOUNDARY_TOL_M
) {
  const loopsIdx = getFaceLoops(face);
  let bestVertex = null;
  let bestEdge = null;
  face2d.loops.forEach((loop, loopIndex) => {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % n];
      const dv = Math.hypot(p.x - a.x, p.y - a.y);
      if (dv <= tolerance && (!bestVertex || dv < bestVertex.distance)) {
        bestVertex = {
          kind: "VERTEX",
          loopIndex,
          index: i,
          vertexIndex: loopsIdx[loopIndex][i],
          distance: dv,
        };
      }
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const lenSq = ex * ex + ey * ey;
      if (lenSq === 0) continue;
      const t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / lenSq;
      if (t <= 0 || t >= 1) continue;
      const de = Math.hypot(p.x - (a.x + t * ex), p.y - (a.y + t * ey));
      if (de <= tolerance && (!bestEdge || de < bestEdge.distance)) {
        bestEdge = { kind: "EDGE", loopIndex, index: i, t, distance: de };
      }
    }
  });
  return bestVertex ?? bestEdge;
}

// "VERTEX" / "EDGE" (on the boundary, with its location), "INSIDE" or
// "OUTSIDE" (in a hole or beyond the contour).
export function classifyPointOnFace(face2d, face, p, tolerance) {
  const onBoundary = locateOnFaceBoundary(face2d, face, p, tolerance);
  if (onBoundary) return onBoundary;
  const [contour, ...holes] = face2d.loops;
  if (!pointInPolygon2d(p, contour)) return { kind: "OUTSIDE" };
  for (const hole of holes) {
    if (pointInPolygon2d(p, hole)) return { kind: "OUTSIDE" };
  }
  return { kind: "INSIDE" };
}
