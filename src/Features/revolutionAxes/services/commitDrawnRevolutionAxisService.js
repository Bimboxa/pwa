import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import isRevolutionHelperInScope, {
  getScopeIdByListingId,
} from "Features/annotations/utils/isRevolutionHelperInScope";

import { buildRevolutionAxisDraft } from "../utils/buildRevolutionAxisDrafts";

// 3D two-click revolution axis (centre, then radius + diameter direction on a
// HORIZONTAL base map plane) → the SAME plan REVOLUTION_AXIS row the 2D
// REVOLUTION_AXIS_PLAN tool commits (MainMapEditorV3
// handleCommitDrawingFromRevolutionAxis + useHandleCommitDrawing):
//   - centre = one db.points row (normalized against the host image size),
//     referenced by `point: {id}`;
//   - radiusM from the two clicks in image px × meterByPx (rounded 1e-6);
//   - directionDeg in the plan LOCAL metre frame (y up, CCW): atan2(−dy, dx)
//     of the px vector — the storage contract of getRevolutionAxisPlanFrame;
//   - template-less row bound to the scope (scopeId, listingId null), label
//     "Axe N" counted over the scope's axes;
//   - colour / height / offsetZ come from the armed draft (bottom toolbar).
//
// `host` is the hit base map (BaseMap instance or record with image size +
// meterByPx). `createAnnotationFn` = useCreateAnnotation (writes the point
// row in the same transaction, sets createdBy, triggers the refresh).
// Returns the created annotation record, or null on failure.
export default async function commitDrawnRevolutionAxisService({
  center,
  edge,
  host,
  projectId,
  scopeId,
  draft,
  layerId = null,
  createAnnotationFn,
}) {
  if (!center || !edge || !host || !projectId || !createAnnotationFn)
    return null;

  const imageSize =
    typeof host.getImageSize === "function"
      ? host.getImageSize()
      : host.image?.imageSize;
  const meterByPx =
    typeof host.getMeterByPx === "function"
      ? host.getMeterByPx()
      : host.meterByPx;
  const width = imageSize?.width;
  const height = imageSize?.height;
  if (!width || !height) return null;

  const cN = worldToBaseMapNormalized(center, host);
  const eN = worldToBaseMapNormalized(edge, host);
  if (!cN || !eN) return null;

  // Same formulas as the 2D commit (image px, y down).
  const dx = (eN.x - cN.x) * width;
  const dy = (eN.y - cN.y) * height;
  const radiusPx = Math.hypot(dx, dy);
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const radiusM = hasScale
    ? Math.round(radiusPx * meterByPx * 1e6) / 1e6
    : null;
  const directionDeg = (Math.atan2(-dy, dx) * 180) / Math.PI;

  // "Axe N": numbered over the scope's axes, like the 2D commit.
  const axes = (
    await db.annotations.where("projectId").equals(projectId).toArray()
  ).filter((a) => !a.deletedAt && a.type === "REVOLUTION_AXIS");
  const scopeIdByListingId = await getScopeIdByListingId(axes);
  const count = axes.filter((a) =>
    isRevolutionHelperInScope(a, { scopeId, scopeIdByListingId })
  ).length;

  const pointId = nanoid();
  const pointRow = {
    id: pointId,
    x: cN.x,
    y: cN.y,
    baseMapId: host.id,
    projectId,
    listingId: null,
  };

  // Draft fields the bottom toolbar edits (colour, ht., Offset) ride along;
  // the geometry scalars come from the clicks.
  const {
    strokeColor,
    strokeWidth,
    strokeWidthUnit,
    strokeOpacity,
    height: draftHeight,
    offsetZ: draftOffsetZ,
  } = draft ?? {};

  const annotation = {
    ...buildRevolutionAxisDraft(),
    ...(strokeColor ? { strokeColor } : {}),
    ...(strokeWidth != null ? { strokeWidth } : {}),
    ...(strokeWidthUnit ? { strokeWidthUnit } : {}),
    ...(strokeOpacity != null ? { strokeOpacity } : {}),
    ...(draftHeight != null ? { height: draftHeight } : {}),
    ...(draftOffsetZ != null ? { offsetZ: draftOffsetZ } : {}),
    id: nanoid(),
    projectId,
    baseMapId: host.id,
    scopeId: scopeId ?? null,
    listingId: null,
    ...(layerId ? { layerId } : {}),
    point: { id: pointId },
    ...(radiusM != null ? { radiusM } : {}),
    directionDeg,
    label: `Axe ${count + 1}`,
  };

  return await createAnnotationFn(annotation, { pointRowsToSave: [pointRow] });
}
