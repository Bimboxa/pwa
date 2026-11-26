import getBaseMapClipSlabPlanes from "../utils/getBaseMapClipSlabPlanes";

// Module-level holder of the live clipping planes of the base maps used as
// clipping planes: useApplyBaseMapClippingIn3d publishes, per base map, the
// record the planes were built from and the THREE.Plane of each side —
// the ones referenced by the materials (ClippingManager.setBaseMapClips).
//
// The drag of a clip box handle (useBaseMapClipBoxDragHandlers) previews a
// depth by moving those planes in place: no material is touched, the scene
// re-cuts at the next render.

// baseMapId → { record, planes: { front: Plane | null, back: Plane | null } }
let _entries = new Map();

export function setBaseMapClipPlaneEntries(entries) {
  _entries = entries || new Map();
}

// Moves the plane of `side` to `depthM` (preview). No-op when the base map
// is not cutting, or when that side has no plane (no limit).
export function previewBaseMapClipDepth(baseMapId, side, depthM) {
  const entry = _entries.get(baseMapId);
  const plane = entry?.planes?.[side];
  if (!plane) return;
  const key = side === "front" ? "frontM" : "backM";
  const next = getBaseMapClipSlabPlanes({
    ...entry.record,
    clipping3d: { ...entry.record.clipping3d, [key]: depthM },
  }).find((p) => p.side === side);
  if (!next) return;
  plane.normal.set(next.normal.x, next.normal.y, next.normal.z);
  plane.constant = next.constant;
}
