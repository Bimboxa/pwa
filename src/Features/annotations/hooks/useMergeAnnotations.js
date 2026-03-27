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
 * Build a coordinate-keyed mapping from dilated points back to their original points.
 * For each dilated point, finds the nearest original point (should be within dilation distance).
 */
function buildDilatedToOriginalMap(dilatedPolygons, originalPolygons) {
  const allOriginalPoints = originalPolygons.flatMap((p) => p.points || []);
  const map = {};

  for (const polygon of dilatedPolygons) {
    for (const dp of polygon.points) {
      let closest = null;
      let closestDist = Infinity;
      for (const op of allOriginalPoints) {
        const dx = dp.x - op.x;
        const dy = dp.y - op.y;
        const dist = dx * dx + dy * dy;
        if (dist < closestDist) {
          closestDist = dist;
          closest = op;
        }
      }
      if (closest) {
        const key = `${dp.x.toFixed(3)}_${dp.y.toFixed(3)}`;
        map[key] = closest;
      }
    }
  }

  return map;
}

/**
 * Replace dilated points in a merged polygon with their original counterparts.
 * Points that have no mapping (bridge/intersection points) are kept as-is.
 */
function recoverOriginalPoints(mergedPoints, dilatedToOriginalMap) {
  return mergedPoints.map((p) => {
    const key = `${p.x.toFixed(3)}_${p.y.toFixed(3)}`;
    return dilatedToOriginalMap[key] || p;
  });
}

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
      // polygon merge

      const polygonsList = annotations.map((annotation) => ({
        points: annotation.points,
        cuts: annotation.cuts,
      }));

      let result = mergeAllPolygons(polygonsList);

      // dilation fallback for non-overlapping polygons
      if (result.remainingPool && result.remainingPool.length > 0) {
        // Only dilate the partial merge result + remaining pool (not all polygons)
        const failedSet = [result.mergedPolygon, ...result.remainingPool];

        // 1. Strip cuts and simplify points before dilation
        const simplifiedList = failedSet.map((p) => {
          const cleaned = cleanPolygonPoints(p.points);
          return {
            points: cleaned.length >= 3 ? cleaned : p.points,
            cuts: [],
          };
        });

        let merged = false;
        for (const d of [DILATION, DILATION * 3, DILATION * 10]) {
          const dilatedList = simplifiedList.map((p) => {
            const dilated = offsetPolygon(p.points, d);
            return {
              points: dilated.length >= 3 ? dilated : p.points,
              cuts: [],
            };
          });

          const dilatedResult = mergeAllPolygons(dilatedList);

          if (
            !dilatedResult.remainingPool ||
            dilatedResult.remainingPool.length === 0
          ) {
            // Build mapping from dilated coordinates to original points
            const dilatedToOriginalMap = buildDilatedToOriginalMap(
              dilatedList,
              failedSet
            );

            // Recover original points instead of contracting
            const recoveredPoints = recoverOriginalPoints(
              dilatedResult.mergedPolygon.points,
              dilatedToOriginalMap
            );

            if (recoveredPoints.length < 3) continue;

            // Reattach original cuts via polygon-clipping.difference
            const allOriginalCuts = polygonsList.flatMap((p) =>
              (p.cuts || []).filter((c) => c.points?.length >= 3)
            );

            let finalPoints = recoveredPoints;
            let finalCuts = [];

            if (allOriginalCuts.length > 0) {
              const reattached = reattachCuts(recoveredPoints, allOriginalCuts);
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

      const annotationsToDelete = annotations.filter((a, i) => i !== 0);

      await db.transaction("rw", db.annotations, db.points, async () => {
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

        await db.annotations.bulkDelete(annotationsToDelete.map((a) => a.id));
      });
    }

    dispatch(triggerAnnotationsUpdate());
  };
}
