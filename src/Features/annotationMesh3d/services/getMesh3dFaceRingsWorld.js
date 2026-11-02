import baseMapLocalToWorld from "Features/baseMaps/js/baseMapLocalToWorld";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";

import getDisplayedMesh3d from "./getDisplayedMesh3d";
import loadStoredMesh3d from "./loadStoredMesh3d";

// The rings of ONE selected face (part MESH3D_FACE, the second click in 3D)
// as ordered WORLD vertices, the input of the 3D drawing commits:
//
//   [{ ring: [{x, y, z, baseMapId}], isHole }]   (contour first, then holes)
//
// A mesh annotation reads its stored mesh (db only, z relative to offsetZ);
// a regular one reads the conversion of its DISPLAYED object
// (getDisplayedMesh3d: absolute local z, z-fight lift stripped), which only
// exists while the 3D editor is up. The local → world step uses the base
// map's stored pose, not the scene group, so no 1 mm lift is added.
//
// Returns null when the face cannot be read (no editor for a regular
// annotation, face index out of range, no base map frame).
export default async function getMesh3dFaceRingsWorld({
  editor,
  annotation,
  faceIndex,
  baseMap,
}) {
  if (!annotation?.id || !baseMap || !Number.isInteger(faceIndex)) return null;

  let mesh = null;
  let baseOffsetZ = 0;
  if (annotation.isMesh3d) {
    const stored = await loadStoredMesh3d(annotation.id);
    if (!stored) return null;
    mesh = stored.mesh;
    baseOffsetZ = stored.baseOffsetZ;
  } else {
    const displayed = getDisplayedMesh3d(editor, annotation.id);
    if (!displayed) return null;
    mesh = displayed.mesh;
    baseOffsetZ = displayed.baseOffsetZ ?? 0;
  }
  const face = mesh?.faces?.[faceIndex];
  if (!face?.loop?.length) return null;

  const transform = getBaseMapTransform(baseMap);
  const toWorld = (index) => {
    const v = mesh.vertices[index];
    if (!v) return null;
    const world = baseMapLocalToWorld(
      { x: v.x, y: v.y, z: v.z + baseOffsetZ },
      transform
    );
    return { x: world.x, y: world.y, z: world.z, baseMapId: baseMap.id };
  };
  const toRing = (loop) => {
    const ring = loop.map(toWorld);
    return ring.some((v) => !v) ? null : ring;
  };

  const contour = toRing(face.loop);
  if (!contour || contour.length < 3) return null;
  const rings = [{ ring: contour, isHole: false }];
  for (const hole of face.holes || []) {
    const ring = toRing(hole);
    if (ring && ring.length >= 3) rings.push({ ring, isHole: true });
  }
  return rings;
}
