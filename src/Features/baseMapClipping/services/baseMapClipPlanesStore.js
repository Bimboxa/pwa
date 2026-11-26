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

// Moves the planes of a base map (preview) to the given overrides of its
// record: `positionY` (world altitude of a horizontal base map), `frontM`,
// `backM`. Fields left undefined keep the stored value. No-op when the base
// map is not cutting; a side without limit has no plane to move.
export function previewBaseMapClip(baseMapId, { positionY, frontM, backM }) {
  const entry = _entries.get(baseMapId);
  if (!entry) return;
  const { record } = entry;
  const clipping3d = { ...record.clipping3d };
  if (frontM !== undefined) clipping3d.frontM = frontM;
  if (backM !== undefined) clipping3d.backM = backM;
  const position =
    positionY === undefined
      ? record.position
      : { x: 0, z: 0, ...record.position, y: positionY };
  getBaseMapClipSlabPlanes({ ...record, position, clipping3d }).forEach(
    ({ side, normal, constant }) => {
      const plane = entry.planes[side];
      if (!plane) return;
      plane.normal.set(normal.x, normal.y, normal.z);
      plane.constant = constant;
    }
  );
}

// Moves the plane of `side` to `depthM` (preview).
export function previewBaseMapClipDepth(baseMapId, side, depthM) {
  previewBaseMapClip(baseMapId, {
    [side === "front" ? "frontM" : "backM"]: depthM,
  });
}
