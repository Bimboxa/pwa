import coalesceCoplanarFaces from "../../threedMesh/utils/coalesceCoplanarFaces.js";
import {
  cross,
  length,
  normalize,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

import { buildMesh3dFromPlanarFaces } from "./buildMesh3dFromTriangles.js";

// Triangle soup of a CSG-carved solid -> mesh of planar polygon faces (LOCAL
// form), for the « Soustraire définitivement » bake.
//
// buildMesh3dFromTriangles cannot read a CSG output: three-bvh-csg leaves
// T-junctions between the coplanar triangles of a same face (they share
// partial edges only), so its edge-connected components would split one face
// into many fragments. Here every triangle is its own face and the coplanar
// same-facing triangles are unioned in 2D by coalesceCoplanarFaces (scale-aware
// snap + T-junction repair, built for float32 CSG positions); the welding and
// the cross-face T-junction splice are then the shared second half of
// buildMesh3dFromTriangles.
//
// Pure (no three.js). positions: flat xyz array; index: triangle index or
// null (soup). Returns { vertices, faces } or null.

const MIN_TRIANGLE_AREA2 = 1e-10;

export default function buildMesh3dFromCarvedTriangles({
  positions,
  index = null,
}) {
  if (!positions?.length) return null;
  const triCount = (index ? index.length : positions.length / 3) / 3;
  const vertIndex = index ? (t, c) => index[3 * t + c] : (t, c) => 3 * t + c;
  const getPos = (vi) => ({
    x: positions[3 * vi],
    y: positions[3 * vi + 1],
    z: positions[3 * vi + 2],
  });

  const triangles = [];
  for (let t = 0; t < triCount; t++) {
    const a = getPos(vertIndex(t, 0));
    const b = getPos(vertIndex(t, 1));
    const c = getPos(vertIndex(t, 2));
    const raw = cross(sub(b, a), sub(c, a));
    // Slivers are frequent in a CSG output: no area, no face.
    if (length(raw) < MIN_TRIANGLE_AREA2) continue;
    triangles.push({ contour: [a, b, c], holes: [], normal: normalize(raw) });
  }
  if (!triangles.length) return null;

  const faces = coalesceCoplanarFaces(triangles).filter(
    (face) => face?.contour?.length >= 3
  );
  return buildMesh3dFromPlanarFaces(faces);
}
