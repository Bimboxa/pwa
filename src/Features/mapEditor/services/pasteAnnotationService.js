import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import applyPasteTransformToPoints from "Features/mapEditor/utils/applyPasteTransformToPoints";

/**
 * Batch-paste every annotation in the clipboard at the cursor, persisting all
 * points + annotations + mapping-category rows in a SINGLE Dexie transaction,
 * then triggering one Redux update. Always mints fresh point/annotation/cut/
 * mapping ids — never reuses ids from the source annotations, so moving a paste
 * cannot tug the originals.
 *
 * The whole group shares `pasteClipboard.sourceCenter`, so feeding each item
 * its own absolute basePoints with the same (sourceCenter → targetCenter)
 * transform translates the entire group by one delta (relative positions
 * preserved) and rotates/flips it rigidly around the group center.
 *
 * Supported types per item: POLYGON (with cuts), POLYLINE, STRIP, COTE, POINT,
 * MARKER, DETAIL (keeps its detailBaseMapId link and bubble label).
 *
 * @param {Object} params
 * @param {Object} params.pasteClipboard  - { sourceCenter, sourceMeterByPx, items[] } from mapEditorSlice
 * @param {Object} params.pasteTransform  - { rotationDeg, flipX }
 * @param {{x:number,y:number}} params.targetCenter - group anchor (pixel image space)
 * @param {Object} params.baseMap         - active basemap: clones are written on
 *   THIS map (baseMapId retag) and normalized against its imageSize — the source
 *   map may differ when the user switched maps between copy and paste.
 * @param {number} params.targetMeterByPx - optional scale of the active basemap;
 *   combined with pasteClipboard.sourceMeterByPx it rescales the group so
 *   real-world dimensions are preserved across maps of different scales.
 * @param {string} params.activeLayerId   - optional, applied to new annotations
 * @param {Function} params.dispatch      - Redux dispatch
 * @param {Function} params.triggerAnnotationsUpdate - the slice action
 * @returns {Promise<Object[]>}
 */
export default async function pasteAnnotationService({
  pasteClipboard,
  pasteTransform,
  targetCenter,
  baseMap,
  targetMeterByPx,
  activeLayerId,
  dispatch,
  triggerAnnotationsUpdate,
}) {
  if (!pasteClipboard?.items?.length || !targetCenter || !baseMap) return [];

  const imageSize =
    baseMap?.getImageSize?.() || baseMap?.image?.imageSize || null;
  if (!imageSize?.width || !imageSize?.height) return [];
  const { width, height } = imageSize;

  const sourceCenter = pasteClipboard.sourceCenter;

  // Cross-map paste: rescale the group so real-world dimensions are preserved
  // when the target map's scale differs from the map the copy was taken on.
  const sourceMeterByPx = pasteClipboard.sourceMeterByPx;
  const scale =
    sourceMeterByPx > 0 && targetMeterByPx > 0
      ? sourceMeterByPx / targetMeterByPx
      : 1;
  const transform = { ...pasteTransform, scale };

  const allPoints = [];
  const allAnnotations = [];
  const allSourceIds = []; // parallel to allAnnotations: each clone's source id

  function normalize(p, sourceAnnotation) {
    const id = nanoid();
    allPoints.push({
      id,
      x: p.x / width,
      y: p.y / height,
      projectId: sourceAnnotation.projectId,
      // ACTIVE map, not the source's — the user may have switched maps between
      // copy and paste, and useAnnotationsV2 denormalizes against the point's
      // baseMapId imageSize (which is also the one used for x/y above).
      baseMapId: baseMap.id,
      // Informative only — nothing must rely on a point's listingId (the
      // export/purge paths key on referenced ids / baseMapId).
      listingId: sourceAnnotation.listingId,
    });
    return id;
  }

  function refsFrom(transformedPxPoints, sourceRefs, sourceAnnotation) {
    return transformedPxPoints.map((pt, i) => {
      const id = normalize(pt, sourceAnnotation);
      const carriedType = sourceRefs?.[i]?.type;
      return { id, ...(carriedType ? { type: carriedType } : {}) };
    });
  }

  for (const item of pasteClipboard.items) {
    const sourceAnnotation = item.annotation;
    const type = sourceAnnotation?.type;
    if (!type) continue;

    // Start from the source but strip hydrated/runtime-only fields so we don't
    // bloat the DB record with computed data from useAnnotationsV2.
    // `guideLines` is stripped too: its refs point at the SOURCE's db.points,
    // so carrying it over would draw the copy's guide line at the original
    // location and share points with it. It is rebuilt below from the
    // clipboard's baseGuideLines snapshot (same rigid transform, fresh points).
    const {
      points: _srcPoints,
      cuts: _srcCuts,
      point: _srcPoint,
      targetPoint: _srcTargetPoint,
      baseMapName: _srcBaseMapName,
      templateLabel: _srcTemplateLabel,
      annotationTemplate: _srcAnnotationTemplate,
      annotationLabel: _srcAnnotationLabel,
      guideLines: _srcGuideLines,
      isoHeightLines: _srcIsoHeightLines,
      profileLines: _srcProfileLines,
      ...sourceAnnotationCleaned
    } = sourceAnnotation;

    const newAnnotationId = nanoid();
    const clonedAnnotation = {
      ...sourceAnnotationCleaned,
      id: newAnnotationId,
      // Paste lands on the ACTIVE map — the spread above carries the SOURCE
      // baseMapId, which put cross-map pastes back on the original map.
      baseMapId: baseMap.id,
      entityId: undefined, // logical entity link not carried over — would require its own row
      ...(activeLayerId ? { layerId: activeLayerId } : {}),
    };

    // DETAIL: the hydrated `label` is the ENTITY label (useAnnotationsV2 moves
    // the row's own bubble text to `annotationLabel`). The clone has no entity,
    // so persist the bubble text as the row label to keep it displayed.
    if (type === "DETAIL") {
      clonedAnnotation.label =
        sourceAnnotation.annotationLabel ?? sourceAnnotation.label;
    }

    // Pixel-unit size fields must follow the group rescale, otherwise a strip
    // keeps its source px width and changes real-world thickness. Only
    // POLYLINE/STRIP use strokeWidth as a physical band width (getStripePolygons)
    // — POLYGON's stroke is a cosmetic outline. CM-based widths are already
    // real-world and stay untouched.
    if (scale !== 1 && (type === "STRIP" || type === "POLYLINE")) {
      if (
        typeof clonedAnnotation.strokeWidth === "number" &&
        clonedAnnotation.strokeWidthUnit !== "CM"
      ) {
        clonedAnnotation.strokeWidth *= scale;
      }
      if (typeof clonedAnnotation.stripWidthPx === "number") {
        clonedAnnotation.stripWidthPx *= scale;
      }
      if (type === "STRIP" && typeof clonedAnnotation.width === "number") {
        clonedAnnotation.width *= scale;
      }
    }

    if (
      type === "POLYGON" ||
      type === "POLYLINE" ||
      type === "STRIP" ||
      type === "COTE" ||
      type === "RULER"
    ) {
      if (!item.basePoints?.length) continue;
      const transformed = applyPasteTransformToPoints(
        item.basePoints,
        sourceCenter,
        targetCenter,
        transform,
      );
      clonedAnnotation.points = refsFrom(
        transformed,
        sourceAnnotation.points,
        sourceAnnotation,
      );

      if (type === "POLYGON" && item.baseCuts?.length) {
        clonedAnnotation.cuts = item.baseCuts.map((cut, ci) => {
          const cutTransformed = applyPasteTransformToPoints(
            cut.points,
            sourceCenter,
            targetCenter,
            transform,
          );
          return {
            id: nanoid(),
            points: refsFrom(
              cutTransformed,
              sourceAnnotation.cuts?.[ci]?.points,
              sourceAnnotation,
            ),
          };
        });
      } else if (type === "POLYGON") {
        clonedAnnotation.cuts = [];
      }

      // Guide lines: same rigid transform as the contour, fresh db.points,
      // meta (slopePct, isStairs, stairsCount, ...) carried from the snapshot.
      // Ref key is `pointId` (not `id`) — see resolveGuideLine.
      if (item.baseGuideLines?.length) {
        clonedAnnotation.guideLines = item.baseGuideLines.map((gl) => {
          const { points: glPoints, ...meta } = gl;
          const glTransformed = applyPasteTransformToPoints(
            glPoints,
            sourceCenter,
            targetCenter,
            transform,
          );
          return {
            ...meta,
            points: glTransformed.map((pt, i) => ({
              pointId: normalize(pt, sourceAnnotation),
              type: glPoints[i]?.type === "circle" ? "circle" : "square",
            })),
          };
        });
      }

      // Iso height lines: same rigid transform + fresh db.points, meta
      // (height) carried from the snapshot. Ref key is `pointId` too.
      if (item.baseIsoHeightLines?.length) {
        clonedAnnotation.isoHeightLines = item.baseIsoHeightLines.map((l) => {
          const { points: lPoints, ...meta } = l;
          const lTransformed = applyPasteTransformToPoints(
            lPoints,
            sourceCenter,
            targetCenter,
            transform,
          );
          return {
            ...meta,
            points: lTransformed.map((pt) => ({
              pointId: normalize(pt, sourceAnnotation),
              type: "square",
            })),
          };
        });
      }

      // Profile lines: same rigid transform + fresh db.points. Refs carry an
      // inline per-vertex `height` (meters) that must be re-attached from the
      // snapshot refs.
      if (item.baseProfileLines?.length) {
        clonedAnnotation.profileLines = item.baseProfileLines.map((l) => {
          const { points: lPoints, ...meta } = l;
          const lTransformed = applyPasteTransformToPoints(
            lPoints,
            sourceCenter,
            targetCenter,
            transform,
          );
          return {
            ...meta,
            points: lTransformed.map((pt, i) => ({
              pointId: normalize(pt, sourceAnnotation),
              type: "square",
              ...(typeof lPoints[i]?.height === "number"
                ? { height: lPoints[i].height }
                : {}),
            })),
          };
        });
      }
    } else if (type === "POINT" || type === "MARKER" || type === "DETAIL") {
      if (!item.basePoint) continue;
      const [transformed] = applyPasteTransformToPoints(
        [item.basePoint],
        sourceCenter,
        targetCenter,
        transform,
      );
      clonedAnnotation.point = { id: normalize(transformed, sourceAnnotation) };
    } else {
      continue;
    }

    allAnnotations.push(clonedAnnotation);
    allSourceIds.push(sourceAnnotation.id);
  }

  if (allAnnotations.length === 0) return [];

  // Source ids that actually produced a clone, so mapping-category rows can be
  // cloned in a single query below.
  const sourceIds = allSourceIds.filter(Boolean);

  // Single transaction: write points + annotations + cloned mapping rows.
  await db.transaction(
    "rw",
    [db.points, db.annotations, db.relAnnotationMappingCategory],
    async () => {
      if (allPoints.length > 0) {
        await db.points.bulkAdd(allPoints);
      }
      await db.annotations.bulkAdd(allAnnotations);

      // Clone mapping-category rows from the sources so qty sums work
      // immediately. One query for all sources, then re-key per pasted clone.
      const sourceMappingRows = sourceIds.length
        ? await db.relAnnotationMappingCategory
            .where("annotationId")
            .anyOf(sourceIds)
            .toArray()
        : [];

      if (sourceMappingRows.length > 0) {
        const rowsBySourceId = new Map();
        for (const r of sourceMappingRows) {
          const list = rowsBySourceId.get(r.annotationId) || [];
          list.push(r);
          rowsBySourceId.set(r.annotationId, list);
        }
        const clonedMappingRows = [];
        for (let i = 0; i < allAnnotations.length; i++) {
          const rows = rowsBySourceId.get(allSourceIds[i]);
          if (!rows) continue;
          for (const r of rows) {
            clonedMappingRows.push({
              ...r,
              id: nanoid(),
              annotationId: allAnnotations[i].id,
            });
          }
        }
        if (clonedMappingRows.length > 0) {
          await db.relAnnotationMappingCategory.bulkAdd(clonedMappingRows);
        }
      }
    },
  );

  // Single Redux dispatch after the transaction commits — one liveQuery rerun.
  if (dispatch && triggerAnnotationsUpdate) {
    dispatch(triggerAnnotationsUpdate());
  }

  return allAnnotations;
}
