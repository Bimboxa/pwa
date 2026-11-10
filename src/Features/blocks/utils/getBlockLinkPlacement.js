import { hostPxToBlockPoint } from "./blockInstanceGeometry.js";

// Where the annotations of a « Lier à un bloc » move land on the blocks base
// map, and where the instance that replaces them sits on the host.
//
// The move is a paste (pasteAnnotationService, keepSourceIds): the group is
// scaled by hostMeterByPx / blockMeterByPx about `sourceCenterPx`, turned by
// `rotationDeg`, then its center is put on `targetCenterPx`.
//
//   sourceCenterPx: center of the selection, host pixels
//   hostMeterByPx / blockMeterByPx: scales of the host / blocks base map
//   originPx: the block insertion point in blocks-base-map pixels, or null
//     when the block has none yet
//   slotCenterPx: free spot on the blocks base map (blocks-base-map pixels),
//     used when the block has no origin yet
//   referenceInstance: {anchorPx, rotation, offsetZ} of the instance of this
//     block the selection is expressed against, or null
//
// Returns {
//   targetCenterPx, rotationDeg,   → paste arguments
//   originPx,                      → insertion point of the block afterwards
//   setsOrigin,                    → the block origin must be written
//   instance: {anchorPx, rotation} | null,  → instance to create on the host
//   offsetZDelta                   → added to the members' offsetZ (meters)
// }
//
// Three cases:
// 1. no origin yet: the selection center BECOMES the origin, at the free
//    slot; an instance is created at the selection center, not turned —
//    nothing moves on screen.
// 2. origin + reference instance: the members are expressed in that
//    instance's frame (inverse rotation, inverse altitude); no new instance —
//    every instance of the block shows them, the reference one in place.
// 3. origin, no instance on this base map: the selection center is mapped
//    onto the origin and an instance is created at the selection center.
//
// Pure: node-testable.
export default function getBlockLinkPlacement({
  sourceCenterPx,
  hostMeterByPx,
  blockMeterByPx,
  originPx,
  slotCenterPx,
  referenceInstance,
}) {
  if (!sourceCenterPx || !(hostMeterByPx > 0) || !(blockMeterByPx > 0))
    return null;

  // 1. new origin
  if (!originPx) {
    if (!slotCenterPx) return null;
    return {
      targetCenterPx: { x: slotCenterPx.x, y: slotCenterPx.y },
      rotationDeg: 0,
      originPx: { x: slotCenterPx.x, y: slotCenterPx.y },
      setsOrigin: true,
      instance: { anchorPx: { ...sourceCenterPx }, rotation: 0 },
      offsetZDelta: 0,
    };
  }

  // 2. expressed in the frame of an existing instance
  if (referenceInstance?.anchorPx) {
    const rotation = Number(referenceInstance.rotation) || 0;
    const centerM = hostPxToBlockPoint({
      pointPx: sourceCenterPx,
      anchorPx: referenceInstance.anchorPx,
      rotationDeg: rotation,
      hostMeterByPx,
    });
    return {
      targetCenterPx: {
        x: originPx.x + centerM.x / blockMeterByPx,
        y: originPx.y + centerM.y / blockMeterByPx,
      },
      rotationDeg: -rotation,
      originPx: { ...originPx },
      setsOrigin: false,
      instance: null,
      offsetZDelta: -(Number(referenceInstance.offsetZ) || 0),
    };
  }

  // 3. origin, no instance here
  return {
    targetCenterPx: { ...originPx },
    rotationDeg: 0,
    originPx: { ...originPx },
    setsOrigin: false,
    instance: { anchorPx: { ...sourceCenterPx }, rotation: 0 },
    offsetZDelta: 0,
  };
}
