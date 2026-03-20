import { nanoid } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import polygonClipping from "polygon-clipping";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import mergeAllPolygons from "Features/geometry/utils/mergeAllPolygons";
import mergePolylines from "Features/geometry/utils/mergePolylines";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";
import cleanPolygonPoints from "Features/geometry/utils/cleanPolygonPoints";

import db from "App/db/db";

const DILATION = 2;

/**
 * Punch original cuts back into a merged outer boundary using polygon-clipping.difference.
 */
function reattachCuts(outerPoints, cuts) {
  // Build GeoJSON outer ring (closed)
  const outerRing = outerPoints.map((p) => [p.x, p.y]);
  outerRing.push([outerPoints[0].x, outerPoints[0].y]);

  let currentGeoJson = [[[...outerRing]]];

  // Subtract each cut
  for (const cut of cuts) {
    const cutRing = cut.points.map((p) => [p.x, p.y]);
    cutRing.push([cut.points[0].x, cut.points[0].y]);

    try {
      const diffResult = polygonClipping.difference(currentGeoJson, [
        [cutRing],
      ]);
      if (diffResult.length > 0) {
        currentGeoJson = diffResult;
      }
    } catch {
      // If difference fails for this cut, skip it
    }
  }

  // Convert first result polygon back to {points, cuts} format
  const resultPolygon = currentGeoJson[0];
  if (!resultPolygon || resultPolygon.length === 0) {
    return { points: outerPoints, cuts: [] };
  }

  // Build a lookup from original outer + cut points
  const pointByXY = {};
  for (const p of outerPoints) {
    pointByXY[`${p.x.toFixed(3)}_${p.y.toFixed(3)}`] = p;
  }
  for (const cut of cuts) {
    for (const p of cut.points) {
      pointByXY[`${p.x.toFixed(3)}_${p.y.toFixed(3)}`] = p;
    }
  }

  const mapRing = (ring) => {
    const pts = ring.slice(0, -1); // remove closing duplicate
    return pts.map(([x, y]) => {
      const key = `${x.toFixed(3)}_${y.toFixed(3)}`;
      return pointByXY[key] || { id: nanoid(), x, y };
    });
  };

  const finalPoints = mapRing(resultPolygon[0]);
  const finalCuts = resultPolygon.slice(1).map((holeRing) => ({
    id: nanoid(),
    points: mapRing(holeRing),
  }));

  return { points: finalPoints, cuts: finalCuts };
}

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
        // 1. Strip cuts and simplify points before dilation
        const simplifiedList = polygonsList.map((p) => ({
          points: cleanPolygonPoints(p.points),
          cuts: [],
        }));

        let merged = false;
        for (const d of [DILATION, DILATION * 3, DILATION * 10]) {
          const dilatedList = simplifiedList.map((p) => ({
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

            // 2. Reattach original cuts via polygon-clipping.difference
            const allOriginalCuts = polygonsList.flatMap((p) =>
              (p.cuts || []).filter((c) => c.points?.length >= 3)
            );

            let finalPoints = contractedPoints;
            let finalCuts = [];

            if (allOriginalCuts.length > 0) {
              const reattached = reattachCuts(contractedPoints, allOriginalCuts);
              finalPoints = reattached.points;
              finalCuts = reattached.cuts;
            }

            result = {
              mergedPolygon: { points: finalPoints, cuts: finalCuts },
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
