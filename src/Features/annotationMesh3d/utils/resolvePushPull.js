import { add, scale } from "../../threedMesh/utils/vec3Utils.js";

import getPushPullRange from "./getPushPullRange.js";
import { MIN_THICKNESS_M } from "./mesh3dConstants.js";
import { cloneFace, compactMesh3d, getFaceNormal } from "./mesh3dTopology.js";
import pushPullMesh3dFace from "./pushPullMesh3dFace.js";

// One face of a mesh as a lone sheet, shifted by `offset` meters along its
// normal — what is left of a prism whose face reached the opposite cap.
export function getMesh3dFaceSheet(mesh, faceIndex, offset = 0) {
  const face = mesh?.faces?.[faceIndex];
  if (!face) return null;
  const shift = scale(getFaceNormal(mesh.vertices, face), offset);
  return compactMesh3d({
    vertices: mesh.vertices.map((v) => add(v, shift)),
    faces: [cloneFace(face)],
  });
}

// The distance really applied for a requested one: { applied, remaining }.
//
// - Within the material limit (range.min / max): applied as is, clamped when
//   the face cannot go through (remaining = null).
// - Past the opposite cap of a prism (range.through): the solid is gone and
//   `remaining` (< 0) is what the face still travels beyond that cap. The
//   last MIN_THICKNESS_M on both sides of the cap stick to the thinnest slab,
//   so the result is never a degenerate sliver.
export function resolvePushPullValue(distance, range) {
  const d = Number(distance) || 0;
  const { min = 0, max = 0, through = null } = range || {};
  if (through && d < min) {
    const remaining = d + through.depth;
    if (remaining <= -MIN_THICKNESS_M) return { applied: d, remaining };
  }
  return { applied: Math.min(max, Math.max(min, d)), remaining: null };
}

// Push/pull of a face with its limits resolved: { mesh, applied }. THE entry
// point of the tools (ghost, shown value and commit must agree).
//
// Past the opposite cap of a prism, the face restarts as a lone sheet on that
// cap and keeps going: an open basin when it digs down, a closed prism
// otherwise (see pushPullMesh3dFace).
export default function resolvePushPull(
  mesh,
  faceIndex,
  distance,
  range = getPushPullRange(mesh, faceIndex)
) {
  const { applied, remaining } = resolvePushPullValue(distance, range);
  if (remaining !== null) {
    const sheet = getMesh3dFaceSheet(mesh, faceIndex, -range.through.depth);
    return { mesh: pushPullMesh3dFace(sheet, 0, remaining), applied };
  }
  return { mesh: pushPullMesh3dFace(mesh, faceIndex, applied), applied };
}
