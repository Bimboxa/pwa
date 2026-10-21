// Module-level holder for the 3D cut-axis rotation handles of the selected
// plan REVOLUTION_AXIS (mirror of annotationLabelObjectsStore).
// ThreedRevolutionAxisHandles publishes on every rebuild; the handles are
// Sprites, so MainThreedEditor's annotation raycast (`.isMesh` only) never
// sees them — useRevolutionAxisHandleDragHandlers raycasts them explicitly.

let _handles = [];

export function setRevolutionAxisHandles(handles) {
  _handles = handles || [];
}

export function getRevolutionAxisHandles() {
  return _handles;
}

export function clearRevolutionAxisHandles() {
  _handles = [];
}
