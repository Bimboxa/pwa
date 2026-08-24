// Module-level session state of the "Déplacer" (move base map) 3D tool,
// shared between the overlay (writes the live snap on pointermove) and the
// pointer handlers (read it on click) — same pattern as lastSnapStore /
// lastDimensionSnapStore.

// { position: Vector3, kind: "VERTEX" | "FREE", meshKey? } | null
let lastSnap = null;

// The in-progress grab:
// {
//   baseMapId,
//   startWorld: Vector3,          // grabbed point, world space
//   groupStartPosition: Vector3,  // base map group position at grab time
//   excludeMeshKeys: Set<string>, // uuids of the carried group's meshes
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
