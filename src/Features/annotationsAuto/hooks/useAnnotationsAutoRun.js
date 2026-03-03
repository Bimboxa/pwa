import { useDispatch, useSelector } from "react-redux";

import { setPendingResult, setShowConfirmDialog } from "../annotationsAutoSlice";

import db from "App/db/db";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

import procedures from "Data/edx/automatedAnnotationsProcedures";

export default function useAnnotationsAutoRun() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMap = useMainBaseMap();

  return async ({ sourceListingId, targetListingId, procedureKey }) => {
    // data

    const baseMapId = baseMap?.id;
    const imageSize = baseMap?.image?.imageSize;
    const meterByPx = baseMap?.getMeterByPx?.();

    if (!baseMapId || !imageSize || !meterByPx || !projectId) {
      console.warn("[useAnnotationsAutoRun] Missing baseMap data");
      return null;
    }

    // fetch source annotations from Dexie

    const rawAnnotations = (
      await db.annotations.where("baseMapId").equals(baseMapId).toArray()
    )
      .filter((r) => !r.deletedAt)
      .filter((a) => a.listingId === sourceListingId);

    // fetch points for this baseMap

    const rawPoints = (
      await db.points.where("baseMapId").equals(baseMapId).toArray()
    ).filter((r) => !r.deletedAt);

    const pointsIndex = getItemsByKey(rawPoints, "id");

    // resolve annotations to pixel coordinates

    const sourceAnnotations = rawAnnotations
      .filter((a) => a.type === "POLYLINE" || a.type === "POLYGON")
      .map((annotation) => ({
        ...annotation,
        points: resolvePoints({
          points: annotation.points,
          pointsIndex,
          imageSize,
        }),
        cuts: annotation.cuts
          ? resolveCuts({ cuts: annotation.cuts, pointsIndex, imageSize })
          : null,
      }));

    // fetch relAnnotationMappingCategory for source annotations

    const annotationIds = sourceAnnotations.map((a) => a.id);
    const sourceRels = await db.relAnnotationMappingCategory
      .where("annotationId")
      .anyOf(annotationIds)
      .toArray();

    // fetch target annotation templates

    const targetAnnotationTemplates = (
      await db.annotationTemplates
        .where("listingId")
        .equals(targetListingId)
        .toArray()
    ).filter((r) => !r.deletedAt);

    // load and run procedure

    const procedureEntry = procedures.find((p) => p.key === procedureKey);
    if (!procedureEntry) {
      console.warn("[useAnnotationsAutoRun] Procedure not found:", procedureKey);
      return null;
    }

    const procedureModule = await procedureEntry.procedure();
    const procedureFn = procedureModule.default;

    const result = procedureFn({
      sourceAnnotations,
      sourceRels,
      targetAnnotationTemplates,
      imageSize,
      meterByPx,
      context: { projectId, baseMapId, targetListingId },
    });

    // dispatch result for confirmation

    dispatch(setPendingResult(result));
    dispatch(setShowConfirmDialog(true));

    return result;
  };
}
