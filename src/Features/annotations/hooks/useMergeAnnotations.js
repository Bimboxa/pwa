import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import mergeAllPolygons from "Features/geometry/utils/mergeAllPolygons";
import mergePolylines from "Features/geometry/utils/mergePolylines";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";

import db from "App/db/db";

const DILATION = 2;

export default function useMergeAnnotations() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  return async (annotations, { shape } = {}) => {
    const resolvedShape =
      shape || resolveDrawingShapeFromType(annotations[0].type);
    const annotation0 = annotations[0];
    const annotationsToDelete = annotations.filter((a, i) => i !== 0);

    if (resolvedShape === "POLYLINE") {
      // polyline merge

      const polylinesList = annotations.map((a) => a.points);
      const mergedPoints = mergePolylines(polylinesList);

      await db.annotations.update(annotation0.id, {
        points: mergedPoints,
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      });
    } else if (resolvedShape === "POLYGON") {
      // polygon merge

      const polygonsList = annotations.map((annotation) => ({
        points: annotation.points,
        cuts: annotation.cuts,
      }));

      let result = mergeAllPolygons(polygonsList);

      // dilation fallback for non-overlapping polygons
      if (result.remainingPool && result.remainingPool.length > 0) {
        let merged = false;
        for (const d of [DILATION, DILATION * 3, DILATION * 10]) {
          const dilatedList = polygonsList.map((p) => ({
            points: offsetPolygon(p.points, d),
            cuts: [],
          }));
          const dilatedResult = mergeAllPolygons(dilatedList);

          if (
            !dilatedResult.remainingPool ||
            dilatedResult.remainingPool.length === 0
          ) {
            const contractedPoints = offsetPolygon(
              dilatedResult.mergedPolygon.points,
              -d
            );
            result = {
              mergedPolygon: {
                points: contractedPoints,
                cuts: dilatedResult.mergedPolygon.cuts,
              },
              newPoints: dilatedResult.newPoints,
            };
            merged = true;
            break;
          }
        }

        if (!merged) {
          console.warn("Merge failed: polygons are too far apart to merge.");
          return;
        }
      }

      // create new points in db
      const { width, height } = baseMap?.image?.imageSize || {
        width: 1,
        height: 1,
      };

      if (result.newPoints?.length > 0) {
        await db.points.bulkAdd(
          result.newPoints.map((point) => ({
            ...point,
            x: point.x / width,
            y: point.y / height,
            projectId: annotation0.projectId,
            baseMapId: annotation0.baseMapId,
          }))
        );
      }

      await db.annotations.update(annotation0.id, {
        points: result.mergedPolygon.points,
        cuts: result.mergedPolygon.cuts,
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      });
    }

    // delete merged annotations

    await db.annotations.bulkDelete(annotationsToDelete.map((a) => a.id));

    // updates

    dispatch(triggerAnnotationsUpdate());
  };
}
