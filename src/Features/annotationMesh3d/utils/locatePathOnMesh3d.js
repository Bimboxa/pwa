import { projectPointTo2d } from "../../threedMesh/utils/planeProjection.js";

import { ON_PLANE_TOL_M } from "./mesh3dConstants.js";
import { classifyPointOnFace, getFace2d } from "./mesh3dFace2d.js";
import { getDistanceToFacePlane, getFaceNormal } from "./mesh3dTopology.js";

// Index of the face a drawn path lies on, or -1.
//
// A face carries the path when every point is on its plane and inside it (or
// on its boundary), and at least one point or segment midpoint is strictly
// inside — a path running along an edge belongs to no face in particular.
//
// points: [{x, y, z}] local meters. closed: also test the closing segment.
// faceIndices: the only faces that may carry the path (null: any face).
export default function locatePathOnMesh3d(
  mesh,
  points,
  { closed = false, faceIndices = null } = {}
) {
  if (!mesh?.faces?.length || !points?.length) return -1;
  const { vertices, faces } = mesh;

  const probes = [...points];
  const segmentCount = closed ? points.length : points.length - 1;
  for (let i = 0; i < segmentCount; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    probes.push({
      x: (p.x + q.x) / 2,
      y: (p.y + q.y) / 2,
      z: (p.z + q.z) / 2,
    });
  }

  const candidates =
    faceIndices ?? Array.from({ length: faces.length }, (_, i) => i);
  for (const faceIndex of candidates) {
    const face = faces[faceIndex];
    if (!face) continue;
    const normal = getFaceNormal(vertices, face);
    if (
      probes.some(
        (p) =>
          Math.abs(getDistanceToFacePlane(vertices, face, p, normal)) >
          ON_PLANE_TOL_M
      )
    ) {
      continue;
    }
    const face2d = getFace2d(vertices, face);
    let hasInside = false;
    let hasOutside = false;
    for (const p of probes) {
      const where = classifyPointOnFace(
        face2d,
        face,
        projectPointTo2d(p, face2d.basis)
      );
      if (where.kind === "OUTSIDE") {
        hasOutside = true;
        break;
      }
      if (where.kind === "INSIDE") hasInside = true;
    }
    if (!hasOutside && hasInside) return faceIndex;
  }
  return -1;
}
