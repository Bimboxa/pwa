// Module-level holder for the currently-rendered dimension ("cote") sprites.
// ThreedDimensions publishes its label sprites here on every rebuild so the
// MainThreedEditor click handler can raycast against them (sprites are not
// meshes, so the annotation raycast — which filters `.isMesh` — never sees
// them). Each entry is a THREE.Sprite carrying `userData.coteId`.

let _objects = [];

export function setDimensionObjects(objects) {
  _objects = objects || [];
}

export function getDimensionObjects() {
  return _objects;
}

export function clearDimensionObjects() {
  _objects = [];
}
