// Module-level session state of the "Déplacer" (move base map) 3D tool,
// shared between the overlay (writes the live snap on pointermove) and the
// pointer handlers (read it on click) — same pattern as lastSnapStore /
// lastDimensionSnapStore.

// { position: Vector3, kind: "VERTEX" | "EDGE" | "PLANE" | "AXIS" | "FREE",
//   meshKey?, baseMapId?, axisA?, axisB?, axis? ("X" | "Y" | "Z" of an AXIS
//   snap — Shift ortho lock) } | null
let lastSnap = null;

// The in-progress grab:
// {
//   baseMapId,
//   startWorld: Vector3,         // grabbed point, world space
//   groupStartPosition: Vector3, // base map group position at grab time
//   followers,                   // revolution family following live (plan
//                                // axis root / sibling elevations —
//                                // revolutionFollowers)
//   targetVerts,                 // target-only snap index (carried subtree
//   targetAdjacency,             // + followers excluded), built at grab time
// } | null
let grab = null;

export function setLastMoveSnap(snap) {
  lastSnap = snap;
}

export function getLastMoveSnap() {
  return lastSnap;
}

export function setMoveGrab(value) {
  grab = value;
}

export function getMoveGrab() {
  return grab;
}

export function clearMoveGrab() {
  grab = null;
}
