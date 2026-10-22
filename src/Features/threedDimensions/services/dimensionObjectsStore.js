// Module-level holder for the currently-rendered dimension label sprites
// (cote and ruler value cards). ThreedCoteAnnotations and
// ThreedRulerAnnotations each publish their sprites here under their own
// owner key on every rebuild, so the MainThreedEditor click handler and the
// label drag hooks can raycast against them (sprites are not meshes, so the
// annotation raycast — which filters `.isMesh` — never sees them). Each
// entry is a THREE.Sprite carrying `userData.annotationId` (the owning COTE
// / RULER annotation) and `userData.annotationType`.
//
// Owners: "COTE" (ThreedCoteAnnotations) and "RULER" (ThreedRulerAnnotations).

const _byOwner = new Map();
let _flat = [];

function refresh() {
  _flat = [..._byOwner.values()].flat();
}

export function setDimensionObjects(owner, objects) {
  _byOwner.set(owner, objects || []);
  refresh();
}

// Without `owner`: every published sprite (the selection pre-pass).
export function getDimensionObjects(owner) {
  if (owner) return _byOwner.get(owner) || [];
  return _flat;
}

export function clearDimensionObjects(owner) {
  if (owner) _byOwner.delete(owner);
  else _byOwner.clear();
  refresh();
}
