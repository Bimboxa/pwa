import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

export default function useAnnotationsAutoRun() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const height = useSelector((s) => s.annotationsAuto.height);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const returnTechnique = useSelector(
    (s) => s.annotationsAuto.returnTechnique
  );
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const baseMap = useMainBaseMap();

  // visible annotations for source-less procedures (same as MAP viewer)
  const visibleAnnotations = useAnnotationsV2({
    caller: "useAnnotationsAutoRun",
    enabled: true,
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations: true,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeIsForBaseMapsListings: true,
  });

  return async ({ sourceListingId, procedureKey }) => {
    // data

    const baseMapId = baseMap?.id;
    const imageSize = baseMap?.image?.imageSize;
    const meterByPx = baseMap?.getMeterByPx?.();

    if (!baseMapId || !imageSize || !meterByPx || !projectId) {
      console.warn("[useAnnotationsAutoRun] Missing baseMap data");
      return null;
    }

    // resolve source annotations

    let sourceAnnotations;

    if (sourceListingId) {
      // standard flow: fetch from Dexie by listing

      const rawAnnotations = (
        await db.annotations.where("baseMapId").equals(baseMapId).toArray()
      )
        .filter((r) => !r.deletedAt)
        .filter((a) => a.listingId === sourceListingId);

      const rawPoints = (
        await db.points.where("baseMapId").equals(baseMapId).toArray()
      ).filter((r) => !r.deletedAt);

      const pointsIndex = getItemsByKey(rawPoints, "id");

      sourceAnnotations = rawAnnotations
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
    } else {
      // source-less flow: use visible annotations (already resolved by useAnnotationsV2)
      sourceAnnotations = (visibleAnnotations ?? []).filter(
        (a) => a.type === "POLYLINE" || a.type === "POLYGON"
      );
    }

    // fetch relAnnotationMappingCategory for source annotations

    const annotationIds = sourceAnnotations.map((a) => a.id);
    const sourceRels = annotationIds.length
      ? await db.relAnnotationMappingCategory
          .where("annotationId")
          .anyOf(annotationIds)
          .toArray()
      : [];

    // fetch annotation templates per source listing

    const listingIds = [
      ...new Set(sourceAnnotations.map((a) => a.listingId).filter(Boolean)),
    ];

    const templateEntries = await Promise.all(
      listingIds.map(async (lid) => {
        const templates = (
          await db.annotationTemplates
            .where("listingId")
            .equals(lid)
            .toArray()
        ).filter((r) => !r.deletedAt);
        return [lid, templates];
      })
    );
    const templatesByListingId = new Map(templateEntries);

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
      templatesByListingId,
      imageSize,
      meterByPx,
      context: {
        projectId,
        baseMapId,
        height,
        activeLayerId,
        returnTechnique,
      },
    });

    // save directly to database

    const { annotations, points, rels } = result;

    await db.points.bulkAdd(points.map((p) => ({ ...p })));
    await db.annotations.bulkAdd(annotations.map((a) => ({ ...a })));
    if (rels.length > 0) {
      await db.relAnnotationMappingCategory.bulkAdd(
        rels.map((r) => ({ ...r }))
      );
    }

    dispatch(triggerAnnotationsUpdate());

    return result;
  };
}
