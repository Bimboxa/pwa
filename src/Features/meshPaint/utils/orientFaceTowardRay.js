import { dot, length, normalize } from "../../threedMesh/utils/vec3Utils.js";

import { getFaceNewellNormal, orientFaceLoops } from "./meshPaintGeometry.js";

// The side of a face the brush ray hits: the returned face's normal points
// back toward the viewer (dot(normal, rayDir) < 0) and its loops are wound
// about it (contours CCW, holes CW). A grazing ray (dot = 0) keeps the face's
// own orientation. Works in any consistent frame (world or base-map-local).
//
// Pure: node-testable.

export default function orientFaceTowardRay(localFace, rayDir) {
  let n = localFace?.normal ? normalize(localFace.normal) : null;
  if (!n || length(n) === 0) n = getFaceNewellNormal(localFace);
  if (!n) return orientFaceLoops(localFace);
  const facing = dot(n, rayDir || { x: 0, y: 0, z: 0 });
  return orientFaceLoops({
    polygons: localFace.polygons,
    normal: facing > 0 ? { x: -n.x || 0, y: -n.y || 0, z: -n.z || 0 } : n,
  });
}
