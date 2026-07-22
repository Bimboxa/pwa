// Module-level holder for the currently-rendered maille objects (mirror of
// dimensionObjectsStore). ThreedMeshes publishes on every rebuild:
// - `sprites`: clickable label sprites (userData.mesh3dId) — raycast by the
//   MainThreedEditor click handler (sprites are not meshes, the annotation
//   raycast filters `.isMesh` and never sees them).
// - `faceMeshes`: one THREE.Mesh per maille face (userData.mesh3dId +
//   faceIndex) — raycast by the meshing pointer handlers (hover, cut tools).
// - `labelTargetHandles`: grab handle at the pointed end of the label leader
//   of the selected maille — raycast by useMesh3dLabelDragHandlers.

let _sprites = [];
let _faceMeshes = [];
let _labelTargetHandles = [];

export function setMesh3dObjects({
  sprites,
  faceMeshes,
  labelTargetHandles,
} = {}) {
  _sprites = sprites || [];
  _faceMeshes = faceMeshes || [];
  _labelTargetHandles = labelTargetHandles || [];
}

export function getMesh3dSprites() {
  return _sprites;
}

export function getMesh3dFaceMeshes() {
  return _faceMeshes;
}

export function getMesh3dLabelTargetHandles() {
  return _labelTargetHandles;
}

export function clearMesh3dObjects() {
  _sprites = [];
  _faceMeshes = [];
  _labelTargetHandles = [];
}
