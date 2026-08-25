// Module-level holder for the currently-rendered annotation label objects
// (mirror of mesh3dObjectsStore). ThreedAnnotationLabels publishes on every
// rebuild:
// - `sprites`: clickable label card sprites (userData.annotationId) — raycast
//   by useAnnotationLabelDragHandlers (sprites are not meshes, the annotation
//   raycast filters `.isMesh` and never sees them).
// - `targetHandles`: grab handle at the pointed end of the label leader of
//   the selected annotation — raycast before the sprites (they overlap while
//   both label ends sit on the barycenter).

let _sprites = [];
let _targetHandles = [];

export function setAnnotationLabelObjects({ sprites, targetHandles } = {}) {
  _sprites = sprites || [];
  _targetHandles = targetHandles || [];
}

export function getAnnotationLabelSprites() {
  return _sprites;
}

export function getAnnotationLabelTargetHandles() {
  return _targetHandles;
}

export function clearAnnotationLabelObjects() {
  _sprites = [];
  _targetHandles = [];
}
