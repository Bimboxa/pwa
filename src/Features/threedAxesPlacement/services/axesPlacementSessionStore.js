// Module-level session state of the « Orienter le repère » (axes placement)
// 3D tool — same pattern as rotateBaseMapSessionStore: the overlay writes
// the snap under the cursor on every pointer move, the click handler reads
// it.

// Snap under the cursor:
// { position: Vector3, kind: "VERTEX" | "PLANE" | "FREE", ... } | null
let lastSnap = null;

// The in-progress placement (origin click done):
// {
//   origin: Vector3,        // 1st click — the new frame origin (world)
//   startPosition: Vector3, // axes helper pose at the origin click, put
//   startRotationY: number, // back on Escape / mode exit
//   startVisible: boolean,
// } | null
let grab = null;

export function setLastAxesPlacementSnap(snap) {
  lastSnap = snap;
}

export function getLastAxesPlacementSnap() {
  return lastSnap;
}

export function setAxesPlacementGrab(value) {
  grab = value;
}

export function getAxesPlacementGrab() {
  return grab;
}

export function clearAxesPlacementGrab() {
  grab = null;
}
