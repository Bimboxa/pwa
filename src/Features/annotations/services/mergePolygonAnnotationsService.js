import { nanoid } from "@reduxjs/toolkit";
import polygonClipping from "polygon-clipping";

import mergeTwoPolygons from "Features/geometry/utils/mergeTwoPolygons";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";
import cleanPolygonPoints from "Features/geometry/utils/cleanPolygonPoints";

import db from "App/db/db";

const DEFAULT_DILATION_SCHEDULE = [2, 6, 20];

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

function recoverOriginalPoints(mergedPoints, dilatedToOriginalMap) {
  return mergedPoints.map((p) => {
    const key = `${p.x.toFixed(3)}_${p.y.toFixed(3)}`;
    return dilatedToOriginalMap[key] || p;
  });
}

function reattachCuts(outerPoints, cuts) {
  const outerRing = outerPoints.map((p) => [p.x, p.y]);
  outerRing.push([outerPoints[0].x, outerPoints[0].y]);

  let currentGeoJson = [[[...outerRing]]];

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

  const resultPolygon = currentGeoJson[0];
  if (!resultPolygon || resultPolygon.length === 0) {
    return { points: outerPoints, cuts: [] };
  }

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
    const pts = ring.slice(0, -1);
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

/**
 * Snowball: starting from `items[0]`, try to merge each remaining item one by
 * one. Returns which items were absorbed (including the starter) and which
 * remain disjoint. Each item is `{ann, shape: {points, cuts}}`.
 */
function snowballMerge(items) {
  if (items.length === 0) {
    return { shape: null, newPoints: [], absorbed: [], remaining: [] };
  }
  const absorbed = [items[0]];
  let shape = { points: items[0].shape.points, cuts: items[0].shape.cuts };
  const newPoints = [];
  const pool = items.slice(1);

  let progress = true;
  while (pool.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const result = mergeTwoPolygons(shape, candidate.shape);
      if (result) {
        shape = result.mergedPolygon;
        if (result.newPoints?.length) newPoints.push(...result.newPoints);
        absorbed.push(candidate);
        pool.splice(i, 1);
        progress = true;
        break;
      }
    }
  }

  return { shape, newPoints, absorbed, remaining: pool };
}

/**
 * Merge a list of POLYGON annotations (with pixel-resolved points) and persist
 * the result to Dexie. The annotation at `winnerIndex` keeps its id; any other
 * annotation that gets absorbed into it is deleted. Annotations that can't be
 * merged (disjoint) are left untouched.
 *
 * @param {Array}  annotations         Annotations with resolved `{x,y,id}` points (+ cuts).
 * @param {Object} options
 * @param {Object} options.baseMap             Base map (to read imageSize for normalization).
 * @param {string} [options.activeLayerId]     Layer to assign to the merged annotation.
 * @param {number} [options.winnerIndex=0]     Index of the annotation that keeps its id.
 * @param {Array<number>} [options.dilationSchedule=[2,6,20]]  Dilation values (px) to try
 *        when no candidate overlaps the winner directly. Pass `[]` to disable fallback.
 * @returns {Promise<{merged: boolean, winnerAnnotationId: string|null, deletedIds: string[]}>}
 */
export default async function mergePolygonAnnotationsService(
  annotations,
  {
    baseMap,
    activeLayerId,
    winnerIndex = 0,
    dilationSchedule = DEFAULT_DILATION_SCHEDULE,
  } = {}
) {
  if (!annotations || annotations.length < 2) {
    return { merged: false, winnerAnnotationId: null, deletedIds: [] };
  }

  const winner = annotations[winnerIndex];
  if (!winner) {
    return { merged: false, winnerAnnotationId: null, deletedIds: [] };
  }

  // Put the winner first so the snowball starts from it.
  const orderedAnnotations = [
    winner,
    ...annotations.filter((_, i) => i !== winnerIndex),
  ];

  const items = orderedAnnotations.map((ann) => ({
    ann,
    shape: { points: ann.points, cuts: ann.cuts },
  }));

  // 1. Try the direct snowball.
  let { shape, newPoints, absorbed, remaining } = snowballMerge(items);
  let mergedGeometry = {
    points: shape.points,
    cuts: shape.cuts ?? [],
  };
  let allNewPoints = newPoints;

  // 2. If nothing was absorbed, dilation fallback on the full set; we then
  //    apply it only to the items that actually merged under dilation.
  if (absorbed.length === 1 && remaining.length > 0 && dilationSchedule.length > 0) {
    const failedSet = items;

    const simplifiedPolygons = failedSet.map(({ shape: s }) => {
      const cleaned = cleanPolygonPoints(s.points);
      return {
        points: cleaned.length >= 3 ? cleaned : s.points,
        cuts: [],
      };
    });

    for (const d of dilationSchedule) {
      const dilatedPolygons = simplifiedPolygons.map((p) => {
        const dilated = offsetPolygon(p.points, d);
        return {
          points: dilated.length >= 3 ? dilated : p.points,
          cuts: [],
        };
      });

      const dilatedItems = dilatedPolygons.map((shape, i) => ({
        ann: failedSet[i].ann,
        shape,
      }));

      const dilatedResult = snowballMerge(dilatedItems);

      if (dilatedResult.absorbed.length > 1) {
        // Recover original points from the dilated merged ring.
        const absorbedOriginals = dilatedResult.absorbed.map((it) =>
          failedSet.find((f) => f.ann.id === it.ann.id)
        );
        const absorbedDilated = dilatedResult.absorbed.map(
          (it) => it.shape
        );
        const dilatedToOriginalMap = buildDilatedToOriginalMap(
          absorbedDilated,
          absorbedOriginals.map((it) => it.shape)
        );

        const recoveredPoints = recoverOriginalPoints(
          dilatedResult.shape.points,
          dilatedToOriginalMap
        );

        if (recoveredPoints.length < 3) continue;

        const allOriginalCuts = absorbedOriginals.flatMap((it) =>
          (it.shape.cuts || []).filter((c) => c.points?.length >= 3)
        );

        let finalPoints = recoveredPoints;
        let finalCuts = [];

        if (allOriginalCuts.length > 0) {
          const reattached = reattachCuts(recoveredPoints, allOriginalCuts);
          finalPoints = reattached.points;
          finalCuts = reattached.cuts;
        }

        mergedGeometry = { points: finalPoints, cuts: finalCuts };
        allNewPoints = dilatedResult.newPoints;
        absorbed = dilatedResult.absorbed;
        remaining = dilatedResult.remaining;
        break;
      }
    }
  }

  // 3. If still nothing merged beyond the winner, bail out.
  if (absorbed.length < 2) {
    return { merged: false, winnerAnnotationId: null, deletedIds: [] };
  }

  // 4. Persist: update winner with merged geometry, delete absorbed-others.
  const { width, height } = baseMap?.image?.imageSize || { width: 1, height: 1 };
  const deletedIds = absorbed.slice(1).map((it) => it.ann.id);

  await db.transaction("rw", db.annotations, db.points, async () => {
    if (allNewPoints?.length > 0) {
      await db.points.bulkAdd(
        allNewPoints.map((point) => ({
          ...point,
          x: point.x / width,
          y: point.y / height,
          projectId: winner.projectId,
          baseMapId: winner.baseMapId,
        }))
      );
    }

    await db.annotations.update(winner.id, {
      points: mergedGeometry.points,
      cuts: mergedGeometry.cuts,
      ...(activeLayerId ? { layerId: activeLayerId } : {}),
    });

    if (deletedIds.length > 0) {
      await db.annotations.bulkDelete(deletedIds);
    }
  });

  return { merged: true, winnerAnnotationId: winner.id, deletedIds };
}
