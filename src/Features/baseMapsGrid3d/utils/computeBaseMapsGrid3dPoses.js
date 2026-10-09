import { Euler, Quaternion, Vector3 } from "three";

import { BASE_MAP_ROTATION_ORDER } from "Features/baseMaps/js/getBaseMapTransform";
import { MM_PER_PT } from "Features/baseMaps/utils/printZone";

// Paper scale used when the anchor base map has no scale of its own: the
// sheets are then sized like paper drawn at 1:100.
const FALLBACK_METER_BY_PT = (MM_PER_PT / 1000) * 100;

function isValidScale(meterByPx) {
  return Number.isFinite(meterByPx) && meterByPx > 0;
}

// Same frame as pixelToWorld: local metres, origin at the centre of the
// reference image, +X right, +Y up (image y-down).
function pxToLocal(px, py, sheet, meterByPx) {
  return new Vector3(
    (px - sheet.refSize.width / 2) * meterByPx,
    -(py - sheet.refSize.height / 2) * meterByPx,
    0
  );
}

// Print zone corners of a sheet in its group's LOCAL frame (metres):
// [topLeft, topRight, bottomRight, bottomLeft].
export function getSheetLocalCorners(sheet, meterByPx) {
  const { x, y, width, height } = sheet.printZone;
  return [
    pxToLocal(x, y, sheet, meterByPx),
    pxToLocal(x + width, y, sheet, meterByPx),
    pxToLocal(x + width, y + height, sheet, meterByPx),
    pxToLocal(x, y + height, sheet, meterByPx),
  ];
}

// Poses of the base map groups laid flat like the sheets of the 2D grid.
// Pure (three maths only).
//
// sheets: [{ id, printZone {x, y, width, height} (reference px),
//   pagePt {width, height}, positionPt {x, y} (top-left, y down — the 2D
//   grid layout), refSize {width, height} (reference px), meterByPx }]
// anchorId: the sheet the grid is laid around. It keeps its position and
//   its yaw; only its tilt changes when it was not horizontal.
// anchorRef: { position {x, y, z}, yaw } — pose of the anchor group.
// K (optional): metres per paper point. Omitted (grid opening), it is taken
//   from the anchor so that the anchor keeps its real size (scale 1). Passed
//   (anchor change while open), the table keeps its size: the new anchor
//   stays exactly as it is, scale included.
// addSlot (optional): { positionPt, pagePt } — the "new base map" frame
//   closing the grid (see buildBaseMapsGrid3dSheets), laid like a sheet.
//
// Every sheet shares the orientation Q = Euler(-π/2, yaw, 0, "YXZ"): local
// +X = paper right, local -Y = paper down, local +Z = world up.
// A sheet i is scaled by s_i = K / (pxPerPt_i × meterByPx_i) so that its
// page measures page_i × K whatever its own scale.
//
// Returns { K, yaw, quaternion, poseById, cornersById, addFrame } with
//   poseById[id] = { position: Vector3, euler: {x, y, z}, scale,
//     effectiveMeterByPx }
//   cornersById[id] = world corners of the print zone in the grid pose.
//   addFrame = { position (world top-left), euler, width, height (metres),
//     corners } or null without addSlot.
export default function computeBaseMapsGrid3dPoses({
  sheets,
  anchorId,
  anchorRef,
  K: fixedK,
  addSlot = null,
}) {
  const anchor = sheets?.find((sheet) => sheet.id === anchorId);
  if (!anchor) return null;

  const yaw = anchorRef?.yaw ?? 0;
  const euler = { x: -Math.PI / 2, y: yaw, z: 0 };
  const quaternion = new Quaternion().setFromEuler(
    new Euler(euler.x, euler.y, euler.z, BASE_MAP_ROTATION_ORDER)
  );

  const getPxPerPt = (sheet) => sheet.printZone.width / sheet.pagePt.width;

  let K = fixedK;
  if (!isValidScale(K)) {
    K = isValidScale(anchor.meterByPx)
      ? getPxPerPt(anchor) * anchor.meterByPx
      : FALLBACK_METER_BY_PT;
  }

  const getEffectiveMeterByPx = (sheet) =>
    isValidScale(sheet.meterByPx) ? sheet.meterByPx : K / getPxPerPt(sheet);
  const getScale = (sheet) =>
    K / (getPxPerPt(sheet) * getEffectiveMeterByPx(sheet));

  // world position of the anchor's print zone top-left corner
  const anchorPosition = new Vector3(
    anchorRef?.position?.x ?? 0,
    anchorRef?.position?.y ?? 0,
    anchorRef?.position?.z ?? 0
  );
  const anchorTopLeft = getSheetLocalCorners(
    anchor,
    getEffectiveMeterByPx(anchor)
  )[0]
    .multiplyScalar(getScale(anchor))
    .applyQuaternion(quaternion)
    .add(anchorPosition);

  // 2D grid offset (paper pt, y down) → grid plane (local +X, local -Y)
  const getWorldTopLeft = (positionPt) =>
    new Vector3(
      (positionPt.x - anchor.positionPt.x) * K,
      -(positionPt.y - anchor.positionPt.y) * K,
      0
    )
      .applyQuaternion(quaternion)
      .add(anchorTopLeft);

  const poseById = {};
  const cornersById = {};

  sheets.forEach((sheet) => {
    const effectiveMeterByPx = getEffectiveMeterByPx(sheet);
    const scale = getScale(sheet);
    const localCorners = getSheetLocalCorners(sheet, effectiveMeterByPx);
    const topLeft = getWorldTopLeft(sheet.positionPt);

    // world(local) = position + Q·(scale·local) — solved for the top-left
    const position = topLeft
      .clone()
      .sub(
        localCorners[0]
          .clone()
          .multiplyScalar(scale)
          .applyQuaternion(quaternion)
      );

    poseById[sheet.id] = {
      position,
      euler: { ...euler },
      scale,
      effectiveMeterByPx,
    };
    cornersById[sheet.id] = localCorners.map((corner) =>
      corner
        .clone()
        .multiplyScalar(scale)
        .applyQuaternion(quaternion)
        .add(position)
    );
  });

  // "new base map" frame: a sheet-like slot with no group of its own, laid
  // at scale 1 from its top-left corner (local +X right, local -Y down)
  let addFrame = null;
  if (addSlot) {
    const width = addSlot.pagePt.width * K;
    const height = addSlot.pagePt.height * K;
    const position = getWorldTopLeft(addSlot.positionPt);
    const corners = [
      new Vector3(0, 0, 0),
      new Vector3(width, 0, 0),
      new Vector3(width, -height, 0),
      new Vector3(0, -height, 0),
    ].map((corner) => corner.applyQuaternion(quaternion).add(position));
    addFrame = { position, euler: { ...euler }, width, height, corners };
  }

  return { K, yaw, quaternion, poseById, cornersById, addFrame };
}
