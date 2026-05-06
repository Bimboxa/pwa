import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

async function loadBaseMapImageData(imageUrl, imageSize) {
  if (!imageUrl || !imageSize?.width || !imageSize?.height) return null;
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imageUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, imageSize.width, imageSize.height);
    return ctx.getImageData(0, 0, imageSize.width, imageSize.height);
  } catch (err) {
    console.warn(
      "[useAnnotationsAutoRun] Could not load base map ImageData:",
      err
    );
    return null;
  }
}

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
  const selectedAnnotationTemplateId = useSelector(
    (s) => s.annotationsAuto.selectedAnnotationTemplateId
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
    // Use reference coordinate space (consistent with useAnnotationsV2),
    // not the active version's actual pixel dimensions which may differ
    // when the version has a scale/translation transform.
    const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
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

    // Pre-load base map pixels once so the procedure (synchronous) can use
    // them for pixel-based classification (e.g. isInteriorCut dark check).
    const imageUrl = baseMap?.getUrl?.();
    const imageData = await loadBaseMapImageData(imageUrl, imageSize);

    // Resolve the user-picked annotationTemplate (used by procedures that
    // expose a template selector via showAnnotationTemplateSelect).
    let targetAnnotationTemplate = null;
    let targetListingId = null;
    if (selectedAnnotationTemplateId) {
      targetAnnotationTemplate = await db.annotationTemplates.get(
        selectedAnnotationTemplateId
      );
      targetListingId = targetAnnotationTemplate?.listingId ?? null;
    }

    const result = procedureFn({
      sourceAnnotations,
      sourceRels,
      templatesByListingId,
      imageSize,
      meterByPx,
      imageData,
      context: {
        projectId,
        baseMapId,
        height,
        activeLayerId,
        returnTechnique,
        targetAnnotationTemplate,
        targetListingId,
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
