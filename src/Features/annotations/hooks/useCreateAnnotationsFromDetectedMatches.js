import { useDispatch } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import applyPasteTransformToPoints from "Features/mapEditor/utils/applyPasteTransformToPoints";

import db from "App/db/db";

/**
 * Bulk-paste the copied annotation at every detected pattern match.
 *
 * Same geometry/transform math as pasteAnnotationService (per-match
 * sourceCenter → match.targetCenter, fresh point ids, normalized to
 * baseMap.getImageSize()), but writes all matches + cloned mapping rows in
 * a single Dexie transaction, then one Redux refresh.
 *
 * Input: { matches:[{ targetCenter }], clipboard, pasteTransform, baseMap,
 *          activeLayerId }
 */
export default function useCreateAnnotationsFromDetectedMatches() {
  const dispatch = useDispatch();

  return async ({
    matches,
    clipboard,
    pasteTransform,
    baseMap,
    activeLayerId,
  }) => {
    if (!matches?.length || !clipboard || !baseMap) return [];

    const imageSize =
      baseMap?.getImageSize?.() || baseMap?.image?.imageSize || null;
    if (!imageSize?.width || !imageSize?.height) return [];
    const { width, height } = imageSize;

    // Pattern detection is single-template only (gated upstream to items.length===1).
    const templateItem = clipboard.items?.[0];
    const sourceAnnotation = templateItem?.annotation;
    const sourceCenter = clipboard.sourceCenter;
    const type = sourceAnnotation?.type;
    if (!type) return [];

    // Strip hydrated/runtime-only fields (same as pasteAnnotationService).
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

    // Source mapping rows — read once, cloned per match.
    const sourceMappingRows = await db.relAnnotationMappingCategory
      .where("annotationId")
      .equals(sourceAnnotation.id)
      .toArray();

    const allPoints = [];
    const allAnnotations = [];
    const allMappingRels = [];

    const normalize = (p) => {
      const id = nanoid();
      allPoints.push({
        id,
        x: p.x / width,
        y: p.y / height,
        projectId: sourceAnnotation.projectId,
        baseMapId: sourceAnnotation.baseMapId,
      });
      return id;
    };

    const refsFrom = (transformedPxPoints, sourceRefs) =>
      transformedPxPoints.map((pt, i) => {
        const id = normalize(pt);
        const carriedType = sourceRefs?.[i]?.type;
        return { id, ...(carriedType ? { type: carriedType } : {}) };
      });

    for (const match of matches) {
      const targetCenter = match.targetCenter;
      if (!targetCenter) continue;

      const newAnnotationId = nanoid();
      const clonedAnnotation = {
        ...sourceAnnotationCleaned,
        id: newAnnotationId,
        entityId: undefined,
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      };

      if (type === "POLYGON" || type === "POLYLINE" || type === "STRIP") {
        if (!templateItem.basePoints?.length) continue;
        const transformed = applyPasteTransformToPoints(
          templateItem.basePoints,
          sourceCenter,
          targetCenter,
          pasteTransform,
        );
        clonedAnnotation.points = refsFrom(
          transformed,
          sourceAnnotation.points,
        );

        if (type === "POLYGON" && templateItem.baseCuts?.length) {
          clonedAnnotation.cuts = templateItem.baseCuts.map((cut, ci) => {
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
              ),
            };
          });
        } else if (type === "POLYGON") {
          clonedAnnotation.cuts = [];
        }
      } else if (type === "POINT" || type === "MARKER") {
        if (!templateItem.basePoint) continue;
        const [transformed] = applyPasteTransformToPoints(
          [templateItem.basePoint],
          sourceCenter,
          targetCenter,
          pasteTransform,
        );
        clonedAnnotation.point = { id: normalize(transformed) };
      } else {
        continue;
      }

      allAnnotations.push(clonedAnnotation);

      for (const r of sourceMappingRows) {
        allMappingRels.push({
          ...r,
          id: nanoid(),
          annotationId: newAnnotationId,
        });
      }
    }

    if (allAnnotations.length === 0) return [];

    await db.transaction(
      "rw",
      [db.points, db.annotations, db.relAnnotationMappingCategory],
      async () => {
        if (allPoints.length) await db.points.bulkAdd(allPoints);
        await db.annotations.bulkAdd(allAnnotations);
        if (allMappingRels.length)
          await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);
      },
    );

    dispatch(triggerAnnotationsUpdate());
    return allAnnotations;
  };
}
