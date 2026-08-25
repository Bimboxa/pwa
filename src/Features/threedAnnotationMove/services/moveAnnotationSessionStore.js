// Module-level session state of the "Déplacer" (move annotation) 3D tool,
// shared between the overlay (writes the live snap on pointermove) and the
// pointer handlers (read it on click) — same pattern as
// moveBaseMapSessionStore.

// { position: Vector3, kind: "VERTEX" | "EDGE" | "PLANE" | "FREE",
//   meshKey?, baseMapId?, axisA?, axisB? } | null
let lastSnap = null;

// The in-progress grab:
// {
//   baseMapId,
//   annotationIds,               // carried annotation ids (same base map)
//   startWorld: Vector3,         // grabbed point, world space
//   startLocal: {x, y, z},       // grabbed point, base map LOCAL metres
//                                // (z drives the offsetZ delta of a snapped
//                                // drop at another altitude)
//   rootStartPoses: Map<id, {position: Vector3, rotZ}>, // at grab time
//   targetVerts,                 // target-only snap index (carried roots
//   targetAdjacency,             // excluded), built fresh at grab time
// } | null
let grab = null;

export function setLastMoveAnnotationSnap(snap) {
  lastSnap = snap;
}

export function getLastMoveAnnotationSnap() {
  return lastSnap;
}

export function setMoveAnnotationGrab(value) {
  grab = value;
}

export function getMoveAnnotationGrab() {
  return grab;
}

export function clearMoveAnnotationGrab() {
  grab = null;
}
