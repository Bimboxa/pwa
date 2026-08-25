// Module-level session state of the "Tourner" (rotate annotation) 3D tool —
// same pattern as rotateBaseMapSessionStore.

// Pivot-phase snap: { position: Vector3, kind: "VERTEX", meshKey } | null,
// then the reference / rotation target snaps.
let lastSnap = null;

// The in-progress rotation (3-click flow):
// {
//   baseMapId,
//   annotationIds,               // carried annotation ids (same base map)
//   pivot: Vector3,              // pivot, world space
//   pivotLocal: {x, y, z},       // pivot, base map LOCAL metres
//   rootStartPoses: Map<id, {position: Vector3, rotZ}>, // at pivot click
//   refPoint: Vector3 | null,    // 2nd click: point fixing the reference axis
//   refBearing: number | null,   // reference bearing in LOCAL XY (rad)
//   currentPhi: number,          // live rotation angle (rad, local +Z)
//   angleBuffer: "",             // typed angle (degrees)
//   targetVerts,                 // target-only snap index (carried roots
//   targetAdjacency,             // excluded), built fresh at pivot click
// } | null
let grab = null;

export function setLastRotateAnnotationSnap(snap) {
  lastSnap = snap;
}

export function getLastRotateAnnotationSnap() {
  return lastSnap;
}

export function setRotateAnnotationGrab(value) {
  grab = value;
}

export function getRotateAnnotationGrab() {
  return grab;
}

export function clearRotateAnnotationGrab() {
  grab = null;
}
