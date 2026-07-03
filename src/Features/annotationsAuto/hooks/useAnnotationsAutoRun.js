import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";

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
  const returnTechnique = useSelector((s) => s.annotationsAuto.returnTechnique);
  const ignoreInteriorWalls = useSelector(
    (s) => s.annotationsAuto.ignoreInteriorWalls
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

  return async ({
    sourceListingId,
    procedureKey,
    sourceAnnotationIds,
    autoCreatedFrom,
  }) => {
    // data

    const procedureEntry = procedures.find((p) => p.key === procedureKey);

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

    if (sourceAnnotationIds?.length) {
      // selection flow: restrict visible annotations to the explicit ids
      // (used by the right-panel "Appliquer la procédure" on the selection).
      const idSet = new Set(sourceAnnotationIds);
      const polylikes = (visibleAnnotations ?? []).filter(
        (a) => a.type === "POLYLINE" || a.type === "POLYGON"
      );
      sourceAnnotations = polylikes.filter((a) => idSet.has(a.id));

      // Adjacency context: a procedure can declare mappingCategories whose
      // visible POLYGON / POLYLINE annotations must be part of the run as
      // context (e.g. frontier detection between adjacent floors, JD lines
      // cutting adjacency) even when they are not selected. They are flagged
      // isAdjacencyOnly so the procedure uses them for segment classification
      // but generates no geometry from them. The standard (whole-listing)
      // flow already passes them unflagged.
      const adjacencyCategories = procedureEntry?.adjacencyMappingCategories;
      if (adjacencyCategories?.length) {
        const candidates = polylikes.filter((a) => !idSet.has(a.id));
        const candidateTemplateIds = [
          ...new Set(
            candidates.map((a) => a.annotationTemplateId).filter(Boolean)
          ),
        ];
        const candidateTemplates = candidateTemplateIds.length
          ? (
              await db.annotationTemplates.bulkGet(candidateTemplateIds)
            ).filter(Boolean)
          : [];
        const templateById = new Map(
          candidateTemplates.map((t) => [t.id, t])
        );
        const neighbors = candidates.filter((a) => {
          const categories =
            templateById.get(a.annotationTemplateId)?.mappingCategories ?? [];
          return adjacencyCategories.some((c) => categories.includes(c));
        });
        sourceAnnotations = [
          ...sourceAnnotations,
          ...neighbors.map((a) => ({ ...a, isAdjacencyOnly: true })),
        ];
      }
    } else if (sourceListingId) {
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
      let visible = (visibleAnnotations ?? []).filter(
        (a) => a.type === "POLYLINE" || a.type === "POLYGON"
      );

      // For ANNOTATIONS_CREATOR procedures, prefer annotations whose template
      // is explicitly linked to this procedure (template.procedureKeys). Fall
      // back to all visible POLYLINE/POLYGON when no visible template
      // references the procedure (avoids regressing legacy setups).
      if (procedureEntry?.type === "ANNOTATIONS_CREATOR") {
        const templateIds = [
          ...new Set(
            visible.map((a) => a.annotationTemplateId).filter(Boolean)
          ),
        ];
        const templates = (
          await db.annotationTemplates.bulkGet(templateIds)
        ).filter(Boolean);
        const procedureKeysByTemplateId = new Map(
          templates.map((t) => [t.id, t.procedureKeys ?? []])
        );
        const hasLinkedTemplate = templates.some((t) =>
          (t.procedureKeys ?? []).includes(procedureKey)
        );
        if (hasLinkedTemplate) {
          visible = visible.filter((a) =>
            (
              procedureKeysByTemplateId.get(a.annotationTemplateId) ?? []
            ).includes(procedureKey)
          );
        }
      }

      sourceAnnotations = visible;
    }

    // fetch raw POINT annotations of the base map, each enriched with a resolved
    // `point` (pixel coords) for geometry. The raw `point: {id}` reference is
    // kept so procedures can persist updates without writing pixel coordinates.

    const rawAllAnnotations = (
      await db.annotations.where("baseMapId").equals(baseMapId).toArray()
    ).filter((r) => !r.deletedAt);

    const rawAllPoints = (
      await db.points.where("baseMapId").equals(baseMapId).toArray()
    ).filter((r) => !r.deletedAt);
    const allPointsIndex = getItemsByKey(rawAllPoints, "id");

    const pointAnnotations = rawAllAnnotations
      .filter((a) => a.type === "POINT" && a.point?.id)
      .map((a) => ({
        ...a,
        resolvedPoint: resolvePoints({
          points: [a.point],
          pointsIndex: allPointsIndex,
          imageSize,
        })[0],
      }));

    // fetch relAnnotationMappingCategory for source annotations + point annotations

    const annotationIds = [
      ...sourceAnnotations.map((a) => a.id),
      ...pointAnnotations.map((a) => a.id),
    ];
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
          await db.annotationTemplates.where("listingId").equals(lid).toArray()
        ).filter((r) => !r.deletedAt);
        return [lid, templates];
      })
    );
    const templatesByListingId = new Map(templateEntries);

    // load and run procedure

    if (!procedureEntry) {
      console.warn(
        "[useAnnotationsAutoRun] Procedure not found:",
        procedureKey
      );
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

    // Obstacle mask: pixel-space footprints of the visible annotations that
    // are NOT floor/ceiling surfaces or this procedure's own outputs (per the
    // procedure's obstacleMask.excludeMappingCategories). The procedure uses
    // it to force cuts surrounding an ouvrage (pillar / concrete) to interior.
    let maskPolygons = [];
    const maskConfig = procedureEntry?.obstacleMask;
    if (maskConfig?.excludeMappingCategories?.length) {
      const excluded = new Set(maskConfig.excludeMappingCategories);
      const maskCandidates = (visibleAnnotations ?? []).filter(
        (a) =>
          a.type === "POLYGON" ||
          a.type === "POLYLINE" ||
          a.type === "STRIP"
      );
      const maskTemplateIds = [
        ...new Set(
          maskCandidates.map((a) => a.annotationTemplateId).filter(Boolean)
        ),
      ];
      const maskTemplates = maskTemplateIds.length
        ? (await db.annotationTemplates.bulkGet(maskTemplateIds)).filter(Boolean)
        : [];
      const maskCatsById = new Map(
        maskTemplates.map((t) => [t.id, t.mappingCategories ?? []])
      );
      for (const a of maskCandidates) {
        const cats = maskCatsById.get(a.annotationTemplateId) ?? [];
        if (cats.some((c) => excluded.has(c))) continue;
        const polys = getAnnotationAsPolygons(a, { meterByPx });
        for (const poly of polys) {
          if (poly?.points?.length >= 3) maskPolygons.push(poly);
        }
      }
    }

    const result = procedureFn({
      sourceAnnotations,
      sourceRels,
      pointAnnotations,
      templatesByListingId,
      imageSize,
      meterByPx,
      imageData,
      maskPolygons,
      context: {
        projectId,
        baseMapId,
        height,
        activeLayerId,
        returnTechnique,
        ignoreInteriorWalls,
        targetAnnotationTemplate,
        targetListingId,
      },
    });

    // save directly to database

    const { annotations, points, rels, updatedAnnotations, annotationPatches } =
      result;

    await db.points.bulkAdd(points.map((p) => ({ ...p })));
    // Tag created annotations with their originating source annotation so they
    // can later be reset/refreshed (see RowProcedureActionAuto).
    await db.annotations.bulkAdd(
      annotations.map((a) => ({
        ...a,
        ...(autoCreatedFrom ? { autoCreatedFrom } : {}),
      }))
    );
    if (rels.length > 0) {
      await db.relAnnotationMappingCategory.bulkAdd(
        rels.map((r) => ({ ...r }))
      );
    }
    if (updatedAnnotations?.length > 0) {
      // Persist preprocessing (e.g. shared-point normalization) by overwriting
      // the touched annotations with their normalized rings/cuts.
      await db.annotations.bulkPut(updatedAnnotations.map((a) => ({ ...a })));
    }
    if (annotationPatches?.length > 0) {
      // Partial field updates (e.g. offsetZ) on existing annotations, without
      // touching their points refs — avoids re-persisting resolved pixel coords.
      for (const { id, changes } of annotationPatches) {
        await db.annotations.update(id, changes);
      }
    }

    dispatch(triggerAnnotationsUpdate());

    return result;
  };
}
