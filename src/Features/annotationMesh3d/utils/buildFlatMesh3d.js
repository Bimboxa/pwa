import { dot, normalize, sub } from "../../threedMesh/utils/vec3Utils.js";

import { ON_PLANE_TOL_M, WELD_PRECISION_M } from "./mesh3dConstants.js";
import { getLoopAreaVector } from "./mesh3dTopology.js";

// A closed coplanar contour drawn on a bare plane -> a one-face mesh (a flat
// sheet, to be pulled into a prism later).
//
// points: [{x, y, z}] in local meters, in drawing order (open loop).
// normalHint: optional vector the face normal should point toward (the side
//   the user looks from) — the loop is reversed when it winds the other way.
// Returns null for a degenerate or non-planar contour.
export default function buildFlatMesh3d(points, normalHint = null) {
  const vertices = [];
  for (const p of points || []) {
    const last = vertices[vertices.length - 1];
    if (
      last &&
      Math.abs(last.x - p.x) < WELD_PRECISION_M &&
      Math.abs(last.y - p.y) < WELD_PRECISION_M &&
      Math.abs(last.z - p.z) < WELD_PRECISION_M
    ) {
      continue;
    }
    vertices.push({ x: p.x, y: p.y, z: p.z });
  }
  if (vertices.length > 1) {
    const first = vertices[0];
    const last = vertices[vertices.length - 1];
    if (
      Math.abs(last.x - first.x) < WELD_PRECISION_M &&
      Math.abs(last.y - first.y) < WELD_PRECISION_M &&
      Math.abs(last.z - first.z) < WELD_PRECISION_M
    ) {
      vertices.pop();
    }
  }
  if (vertices.length < 3) return null;

  let loop = vertices.map((_, i) => i);
  const areaVector = getLoopAreaVector(vertices, loop);
  const normal = normalize(areaVector);
  if (normal.x === 0 && normal.y === 0 && normal.z === 0) return null;

  for (const v of vertices) {
    if (Math.abs(dot(sub(v, vertices[0]), normal)) > ON_PLANE_TOL_M)
      return null;
  }

  if (normalHint && dot(normal, normalHint) < 0) loop = loop.reverse();

  return { vertices, faces: [{ loop, holes: [] }] };
}
