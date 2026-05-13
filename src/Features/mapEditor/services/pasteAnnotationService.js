import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import applyPasteTransformToPoints from "Features/mapEditor/utils/applyPasteTransformToPoints";

/**
 * Build the geometry for a pasted annotation, persist points + annotation +
 * mapping-category rows in a SINGLE Dexie transaction, then trigger one
 * Redux update. Always mints fresh point ids — never reuses ids from the
 * source annotation, so moving the paste cannot tug the original.
 *
 * Supported types: POLYGON (with cuts), POLYLINE, STRIP, POINT, MARKER.
 *
 * @param {Object} params
 * @param {Object} params.pasteClipboard  - snapshot from mapEditorsSlice
 * @param {Object} params.pasteTransform  - { rotationDeg, flipX }
 * @param {{x:number,y:number}} params.targetCenter - bbox center / point position (pixel image space)
 * @param {Object} params.baseMap         - active basemap (provides imageSize)
 * @param {string} params.activeLayerId   - optional, applied to the new annotation
 * @param {Function} params.dispatch      - Redux dispatch
 * @param {Function} params.triggerAnnotationsUpdate - the slice action
 * @returns {Promise<Object|null>}
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
  if (!pasteClipboard || !targetCenter || !baseMap) return null;

  const imageSize =
    baseMap?.getImageSize?.() || baseMap?.image?.imageSize || null;
  if (!imageSize?.width || !imageSize?.height) return null;
  const { width, height } = imageSize;

  const sourceAnnotation = pasteClipboard.annotation;
  const sourceCenter = pasteClipboard.sourceCenter;
  const type = sourceAnnotation?.type;

  const pointsToBulkAdd = [];

  function normalize(p) {
    return {
      id: nanoid(),
      x: p.x / width,
      y: p.y / height,
      projectId: sourceAnnotation.projectId,
      baseMapId: sourceAnnotation.baseMapId,
    };
  }

  function refsFromTransformedPoints(transformedPxPoints, sourceRefs) {
    return transformedPxPoints.map((pt, i) => {
      const record = normalize(pt);
      pointsToBulkAdd.push(record);
      const sourceRef = sourceRefs?.[i];
      const carriedType = sourceRef?.type;
      return { id: record.id, ...(carriedType ? { type: carriedType } : {}) };
    });
  }

  const newAnnotationId = nanoid();

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

  const clonedAnnotation = {
    ...sourceAnnotationCleaned,
    id: newAnnotationId,
    entityId: undefined, // logical entity link not carried over — would require its own row
    ...(activeLayerId ? { layerId: activeLayerId } : {}),
  };

  // --- type-specific geometry rebuild
  if (type === "POLYGON" || type === "POLYLINE" || type === "STRIP") {
    if (!pasteClipboard.basePoints?.length) return null;

    const transformed = applyPasteTransformToPoints(
      pasteClipboard.basePoints,
      sourceCenter,
      targetCenter,
      pasteTransform,
    );
    clonedAnnotation.points = refsFromTransformedPoints(
      transformed,
      sourceAnnotation.points,
    );

    if (type === "POLYGON" && pasteClipboard.baseCuts?.length) {
      clonedAnnotation.cuts = pasteClipboard.baseCuts.map((cut, ci) => {
        const cutTransformed = applyPasteTransformToPoints(
          cut.points,
          sourceCenter,
          targetCenter,
          pasteTransform,
        );
        const sourceCut = sourceAnnotation.cuts?.[ci];
        return {
          id: nanoid(),
          points: refsFromTransformedPoints(
            cutTransformed,
            sourceCut?.points,
          ),
        };
      });
    } else if (type === "POLYGON") {
      clonedAnnotation.cuts = [];
    }
  } else if (type === "POINT" || type === "MARKER") {
    if (!pasteClipboard.basePoint) return null;
    const [transformed] = applyPasteTransformToPoints(
      [pasteClipboard.basePoint],
      sourceCenter,
      targetCenter,
      pasteTransform,
    );
    const record = normalize(transformed);
    pointsToBulkAdd.push(record);
    clonedAnnotation.point = { id: record.id };
  } else {
    return null;
  }

  // Single transaction: clone mapping rows + write points + write annotation.
  await db.transaction(
    "rw",
    [db.points, db.annotations, db.relAnnotationMappingCategory],
    async () => {
      if (pointsToBulkAdd.length > 0) {
        await db.points.bulkAdd(pointsToBulkAdd);
      }

      await db.annotations.put(clonedAnnotation);

      // Clone mapping-category rows from the source so qty sums work
      // immediately. Cheaper than re-fetching the template + re-deriving them.
      const sourceMappingRows = await db.relAnnotationMappingCategory
        .where("annotationId")
        .equals(sourceAnnotation.id)
        .toArray();

      if (sourceMappingRows.length > 0) {
        const clonedMappingRows = sourceMappingRows.map((r) => ({
          ...r,
          id: nanoid(),
          annotationId: newAnnotationId,
        }));
        await db.relAnnotationMappingCategory.bulkAdd(clonedMappingRows);
      }
    },
  );

  // Single Redux dispatch after the transaction commits — one liveQuery rerun.
  if (dispatch && triggerAnnotationsUpdate) {
    dispatch(triggerAnnotationsUpdate());
  }

  return clonedAnnotation;
}
