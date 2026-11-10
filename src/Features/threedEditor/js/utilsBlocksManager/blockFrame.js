import { Group, Matrix4 } from "three";

import pixelToWorld from "../utilsAnnotationsManager/pixelToWorld";

// ---------------------------------------------------------------------------
// Block frame (Features/blocks) in 3D — shared by BlocksManager (the scene)
// and the headless build of a block instance (procedure-driven metering,
// meshPaint/services/createHeadlessBlockPrototypes): both must pose the
// members of a block the same way, to the last millimetre (the geometry hash
// of a painted instance is compared between the two).
//
// Block frame: the frame of the ORIGIN blocks base map, translated to the
// block's insertion point. A member drawn on another blocks base map (an
// elevation) keeps its pose relative to the origin base map.
// ---------------------------------------------------------------------------

export const BLOCK_CONTENT_FLAG = "isBlockContent";

/**
 * World (the scene the prototypes are built in) → block frame.
 *
 * @param {object} args
 * @param {import("three").Object3D} args.frame frame group of the ORIGIN
 *   blocks base map (createBaseMapFrameGroup), world matrix up to date
 * @param {{imageWidth, imageHeight, meterByPx}} args.baseMap render metrics
 *   of that base map (getBaseMapForRender)
 * @param {{x:number, y:number}} args.originPx insertion point, pixels of the
 *   origin base map
 * @param {number} [args.originZ] insertion altitude, meters
 * @returns {Matrix4|null}
 */
export function getBlockInverseMatrix({ frame, baseMap, originPx, originZ }) {
  if (!frame || !baseMap || !originPx) return null;
  const origin = pixelToWorld(originPx, baseMap);
  return frame.matrixWorld
    .clone()
    .multiply(
      new Matrix4().makeTranslation(origin.x, origin.y, Number(originZ) || 0)
    )
    .invert();
}

/**
 * The clones of a block's prototypes, in the BLOCK FRAME (insertion point at
 * the origin, Z = normal of the origin base map): what an instance
 * placeholder holds. Object3D.clone() shares geometries and materials with
 * the prototypes — the clones are tagged `sharedBlockResources` and must
 * never be disposed.
 *
 * @param {object} args
 * @param {Array<import("three").Object3D>} args.prototypes built members,
 *   world matrices up to date
 * @param {Matrix4} args.inverse getBlockInverseMatrix result
 * @param {(prototype, error) => void} [args.onCloneError]
 * @returns {Group}
 */
export function createBlockContentGroup({ prototypes, inverse, onCloneError }) {
  const content = new Group();
  content.userData[BLOCK_CONTENT_FLAG] = true;
  (prototypes ?? []).forEach((prototype) => {
    if (!prototype) return;
    let clone;
    try {
      // geometries and materials are shared with the prototype
      clone = prototype.clone(true);
    } catch (e) {
      onCloneError?.(prototype, e);
      return;
    }
    inverse
      .clone()
      .multiply(prototype.matrixWorld)
      .decompose(clone.position, clone.quaternion, clone.scale);
    clone.traverse((child) => {
      const userData = { ...(child.userData ?? {}) };
      // picking / hover walk up to the INSTANCE root, never to a member
      delete userData.nodeId;
      delete userData.nodeType;
      delete userData.vertexRefs;
      userData.sharedBlockResources = true;
      child.userData = userData;
    });
    content.add(clone);
  });
  return content;
}
