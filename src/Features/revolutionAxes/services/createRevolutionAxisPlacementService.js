import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";
import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";

import { AXIS_BASE_POINT_RATIO } from "../constants/revolutionAxisPage";

// Poses a plan REVOLUTION_AXIS on a vertical base map WITHOUT the placement
// click: writes the REVOLUTION_AXIS_PLACEMENT row at a fixed normalized spot
// (the axis base at the middle of the width, 90% of the height — the same
// fractions as the CHATEAU_EAU_V1 builder) then re-poses the base map in 3D.
//
// Mirrors the click commit of useHandleCommitDrawing: one db.points row
// (normalized [0..1] coordinates, POINTS_STORAGE contract) referenced by
// `point: {id}`; a template-less placement belongs to the axis's scope
// (listingId null + scopeId), like the axis itself.
//
// Meant for a base map just created for the axis: no other placement of the
// scope can already live on it, so nothing is replaced here.
export default async function createRevolutionAxisPlacementService({
  axisId,
  baseMapId,
  ratio = AXIS_BASE_POINT_RATIO,
  dispatch,
}) {
  const axis = await db.annotations.get(axisId);
  if (!axis || axis.deletedAt || axis.type !== "REVOLUTION_AXIS") return null;
  if (!baseMapId) return null;

  const pointId = nanoid();
  const placementId = nanoid();

  await db.points.put({
    id: pointId,
    x: ratio.x,
    y: ratio.y,
    baseMapId,
    projectId: axis.projectId,
    listingId: null,
  });

  const placement = {
    ...getDefaultsForShape("REVOLUTION_AXIS_PLACEMENT"),
    ...(axis.strokeColor ? { strokeColor: axis.strokeColor } : {}),
    id: placementId,
    type: "REVOLUTION_AXIS_PLACEMENT",
    drawingShape: "REVOLUTION_AXIS_PLACEMENT",
    projectId: axis.projectId,
    baseMapId,
    listingId: null,
    annotationTemplateId: null,
    ...(axis.scopeId ? { scopeId: axis.scopeId } : {}),
    revolutionAxisId: axis.id,
    label: axis.label ?? "Axe",
    point: { id: pointId },
  };
  await db.annotations.put(placement);

  await resyncRevolutionAxisPlacementsService({ placementId, dispatch });
  dispatch?.(triggerAnnotationsUpdate());

  return placement;
}
