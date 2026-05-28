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
 * Supported types per item: POLYGON (with cuts), POLYLINE, STRIP, POINT, MARKER.
 *
 * @param {Object} params
 * @param {Object} params.pasteClipboard  - { sourceCenter, items[] } from mapEditorSlice
 * @param {Object} params.pasteTransform  - { rotationDeg, flipX }
 * @param {{x:number,y:number}} params.targetCenter - group anchor (pixel image space)
 * @param {Object} params.baseMap         - active basemap (provides imageSize)
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
      baseMapId: sourceAnnotation.baseMapId,
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
    const {
      points: _srcPoints,
      cuts: _srcCuts,
      point: _srcPoint,
      targetPoint: _srcTargetPoint,
      baseMapName: _srcBaseMapName,
      templateLabel: _srcTemplateLabel,
      annotationTemplate: _srcAnnotationTemplate,
      ...sourceAnnotationCleaned
    } = sourceAnnotation;

    const newAnnotationId = nanoid();
    const clonedAnnotation = {
      ...sourceAnnotationCleaned,
      id: newAnnotationId,
      entityId: undefined, // logical entity link not carried over — would require its own row
      ...(activeLayerId ? { layerId: activeLayerId } : {}),
    };

    if (type === "POLYGON" || type === "POLYLINE" || type === "STRIP") {
      if (!item.basePoints?.length) continue;
      const transformed = applyPasteTransformToPoints(
        item.basePoints,
        sourceCenter,
        targetCenter,
        pasteTransform,
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
            pasteTransform,
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
    } else if (type === "POINT" || type === "MARKER") {
      if (!item.basePoint) continue;
      const [transformed] = applyPasteTransformToPoints(
        [item.basePoint],
        sourceCenter,
        targetCenter,
        pasteTransform,
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
