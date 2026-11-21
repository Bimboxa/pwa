import {
  asClosedSolidOperand,
  getShape3DKey,
} from "Features/annotations/constants/shape3DConfig";

import isFlatPolygonSheet, {
  asFlatSheetOperand,
} from "Features/annotations/utils/isFlatPolygonSheet";

import { getBlockInverseMatrix } from "../utilsBlocksManager/blockFrame";
import createAnnotationObject3D from "./createAnnotationObject3D";
import createBaseMapFrameGroup from "./createBaseMapFrameGroup";

// Operand of a block INSTANCE (Features/blocks): the solids of the members of
// its block that carve (`instance._blockCutters`, attached upstream — see
// annotations/utils/getBlockCuttersByInstanceId), each posed where the
// instance puts it.
//
// Same recipe as BlocksManager / createHeadlessBlockPrototypes: every member
// is built in the frame of ITS OWN blocks base map, brought into the block
// frame (getBlockInverseMatrix), then through the instance placeholder's
// local pose. The returned solids are flat and expressed in the frame of the
// INSTANCE's base map, like any other operand: the caller parents them to
// that base map's group. They own their geometry (no shared clone).
async function buildBlockInstanceSolidObjectsAsync(
  instance,
  baseMapForRender,
  options
) {
  const cutters = instance._blockCutters;
  if (!cutters?.members?.length || !cutters.originBaseMapForRender) return [];

  const placeholder = createAnnotationObject3D(
    { ...instance, _blockCutters: undefined },
    baseMapForRender,
    options
  );
  if (!placeholder) return [];
  placeholder.updateMatrix();

  const frames = new Map(); // blocks baseMapId → frame group
  const getFrame = (baseMapId, transform) => {
    if (!frames.has(baseMapId))
      frames.set(baseMapId, createBaseMapFrameGroup(transform));
    return frames.get(baseMapId);
  };
  const originFrame = getFrame(
    cutters.originBaseMapId,
    cutters.originBaseMapTransform
  );

  const solids = [];
  for (const member of cutters.members) {
    if (!member?.annotation || !member.baseMapForRender) continue;
    const objects = await buildAnnotationSolidObjectsAsync(
      member.annotation,
      member.baseMapForRender,
      options
    );
    const frame = getFrame(
      member.annotation.baseMapId,
      member.baseMapTransform
    );
    for (const object of objects) {
      if (!object) continue;
      frame.add(object);
      solids.push(object);
    }
  }
  if (solids.length === 0) return [];

  frames.forEach((frame) => frame.updateMatrixWorld(true));
  const inverse = getBlockInverseMatrix({
    frame: originFrame,
    baseMap: cutters.originBaseMapForRender,
    originPx: cutters.originPx,
    originZ: cutters.originZ,
  });
  if (!inverse) return [];

  // instance base map frame ← placeholder ← block frame ← world of the frames
  const toInstanceBaseMap = placeholder.matrix.clone().multiply(inverse);
  for (const solid of solids) {
    const local = toInstanceBaseMap.clone().multiply(solid.matrixWorld);
    solid.removeFromParent();
    local.decompose(solid.position, solid.quaternion, solid.scale);
    solid.updateMatrix();
  }
  return solids;
}

/**
 * Resolve an annotation into one or more Object3D solids (to be used as the
 * SUBTRACTION operand). Returned objects are unparented; the caller attaches
 * them to the basemap group so their matrixWorld matches the source's frame.
 *
 * An operand tagged `userData.isFlatSheetCutter` is the wafer of a flat
 * polygon: it only cuts sheet (hollow) hosts — drop it for a solid host.
 *
 * Every annotation builds its solid synchronously via the normal display
 * builder (kept async for its callers' sake).
 *
 * @returns {Promise<Array<import("three").Object3D>>}
 */
export default async function buildAnnotationSolidObjectsAsync(
  annotation,
  baseMapForRender,
  options
) {
  if (!annotation || !baseMapForRender) return [];

  if (annotation.type === "BLOCK_INSTANCE") {
    return buildBlockInstanceSolidObjectsAsync(
      annotation,
      baseMapForRender,
      options
    );
  }

  // A REVOLUTION operand must be the FULL solid (shape3D.solid builds it
  // watertight): the camera-driven 180° half-view is display-only and would
  // otherwise cut the cutter in two. The axis's own partial sector
  // (`revolutionPhi`) still applies — it is part of the annotation.
  let operandOptions = options;
  if (getShape3DKey(annotation.shape3D) === "REVOLUTION" && options) {
    operandOptions = {
      ...options,
      revolutionSection: undefined,
      revolutionSectionFill: false,
    };
  }

  // A « Fosse » operand is its CLOSED prism: the removed top face cuts the
  // coplanar face of a host glued to it. A flat polygon is a wafer standing
  // on its plane: it cuts its footprint out of a coplanar sheet.
  const object = createAnnotationObject3D(
    asClosedSolidOperand(asFlatSheetOperand(annotation)),
    baseMapForRender,
    operandOptions
  );
  if (!object) return [];
  // Tagged for the callers: a wafer must never groove a SOLID host.
  if (isFlatPolygonSheet(annotation)) object.userData.isFlatSheetCutter = true;
  return [object];
}
