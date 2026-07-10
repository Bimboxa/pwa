// Module-level holder for the currently-rendered maille objects (mirror of
// dimensionObjectsStore). ThreedMeshes publishes on every rebuild:
// - `sprites`: clickable label sprites (userData.mesh3dId) — raycast by the
//   MainThreedEditor click handler (sprites are not meshes, the annotation
//   raycast filters `.isMesh` and never sees them).
// - `faceMeshes`: one THREE.Mesh per maille face (userData.mesh3dId +
//   faceIndex) — raycast by the meshing pointer handlers (hover, cut tools).

let _sprites = [];
let _faceMeshes = [];

export function setMesh3dObjects({ sprites, faceMeshes } = {}) {
  _sprites = sprites || [];
  _faceMeshes = faceMeshes || [];
}

export function getMesh3dSprites() {
  return _sprites;
}

export function getMesh3dFaceMeshes() {
  return _faceMeshes;
}

export function clearMesh3dObjects() {
  _sprites = [];
  _faceMeshes = [];
}
