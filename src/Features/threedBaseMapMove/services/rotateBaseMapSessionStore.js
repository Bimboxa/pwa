// Module-level session state of the "Tourner" (rotate base map) 3D tool —
// same pattern as moveBaseMapSessionStore.

// Pivot-phase snap: { position: Vector3, kind: "VERTEX", meshKey } | null
let lastSnap = null;

// The in-progress rotation:
// {
//   baseMapId,
//   pivot: Vector3,              // world point the vertical axis goes through
//   groupStartPosition: Vector3, // base map group position at pivot click
//   groupStartRotY: number,      // group rotation.y at pivot click (rad)
//   refBearing: number | null,   // cursor bearing when the rotation started
//   currentPhi: number,          // live rotation angle (rad)
//   targetVerts,                 // target-only snap index (carried subtree
//   targetAdjacency,             // excluded), built fresh at pivot click
// } | null
let grab = null;

export function setLastRotateSnap(snap) {
  lastSnap = snap;
}

export function getLastRotateSnap() {
  return lastSnap;
}

export function setRotateGrab(value) {
  grab = value;
}

export function getRotateGrab() {
  return grab;
}

export function clearRotateGrab() {
  grab = null;
}
