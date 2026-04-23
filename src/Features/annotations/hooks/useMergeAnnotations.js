import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import mergePolylines from "Features/geometry/utils/mergePolylines";
import mergePolygonAnnotationsService from "Features/annotations/services/mergePolygonAnnotationsService";

import db from "App/db/db";

export default function useMergeAnnotations() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  return async (annotations, { shape } = {}) => {
    const resolvedShape =
      shape || resolveDrawingShapeFromType(annotations[0].type);
    const annotation0 = annotations[0];

    if (resolvedShape === "POLYLINE") {
      // polyline merge

      const polylinesList = annotations.map((a) => a.points);
      const groups = mergePolylines(polylinesList);

      const otherAnnotations = annotations.slice(1);
      const idsToDelete = otherAnnotations
        .filter((_, i) => i >= groups.length - 1)
        .map((a) => a.id);

      await db.transaction("rw", db.annotations, async () => {
        await db.annotations.update(annotation0.id, {
          points: groups[0],
          ...(activeLayerId ? { layerId: activeLayerId } : {}),
        });
        for (let i = 0; i < otherAnnotations.length; i++) {
          if (i < groups.length - 1) {
            await db.annotations.update(otherAnnotations[i].id, {
              points: groups[i + 1],
              ...(activeLayerId ? { layerId: activeLayerId } : {}),
            });
          }
        }
        if (idsToDelete.length > 0) {
          await db.annotations.bulkDelete(idsToDelete);
        }
      });

      dispatch(triggerAnnotationsUpdate());
      return;
    } else if (resolvedShape === "POLYGON") {
      const result = await mergePolygonAnnotationsService(annotations, {
        baseMap,
        activeLayerId,
        winnerIndex: 0,
        dilationSchedule: [2, 6, 20],
      });

      if (!result.merged) {
        console.warn("Merge failed: polygons are too far apart to merge.");
        return;
      }
    }

    dispatch(triggerAnnotationsUpdate());
  };
}
