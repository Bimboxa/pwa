import { nanoid } from "@reduxjs/toolkit";
import polygonClipping from "polygon-clipping";

import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";
import reconcileCuts from "Features/geometry/utils/reconcileCuts";

const toRing = (points) => {
  if (!points || points.length === 0) return [];
  const ring = points.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
};

const ringSignedArea = (ring) => {
  let s = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};

const fromRing = (ring) =>
  ring.slice(0, ring.length - 1).map((p) => ({
    id: nanoid(),
    x: p[0],
    y: p[1],
  }));

/**
 * Carve `drawnShape` by subtracting every clip polygon derived from
 * `candidates`. The result naturally yields outer-contour changes
 * (overlap) and/or new cuts (full containment).
 *
 * When the subtraction splits the shape into several disjoint polygons,
 * `points`/`cuts` describe the largest piece and `pieces` lists them all
 * (largest first), each as {points, cuts}.
 *
 * @param {Object} args
 * @param {{points:Array<{id?,x,y}>, cuts?:Array}} args.drawnShape
 * @param {Array<Object>} args.candidates  resolved annotations (different
 *                                         templateId, visible, bbox-overlapping)
 * @param {Object} args.baseMap            for meterByPx (CM stroke widths)
 * @returns {{points:Array<{id,x,y}>, cuts:Array<{id,label?,points:Array<{id,x,y}>}>, pieces:Array<{points,cuts}>, consumed:boolean}}
 */
export default function avoidVisibleAnnotationsService({
  drawnShape,
  candidates,
  baseMap,
}) {
  const original = {
    points: drawnShape?.points ?? [],
    cuts: drawnShape?.cuts ?? [],
    pieces: [
      { points: drawnShape?.points ?? [], cuts: drawnShape?.cuts ?? [] },
    ],
    consumed: false,
  };

  if (!drawnShape?.points || drawnShape.points.length < 3) return original;
  if (!candidates || candidates.length === 0) return original;

  const meterByPx = baseMap?.getMeterByPx?.();

  const clipShapes = [];
  for (const cand of candidates) {
    const shapes = getAnnotationAsPolygons(cand, { meterByPx });
    for (const shape of shapes) {
      if (!shape?.points || shape.points.length < 3) continue;
      clipShapes.push(shape);
    }
  }

  if (clipShapes.length === 0) return original;

  try {
    const subjectGeom = [
      toRing(drawnShape.points),
      ...(drawnShape.cuts ?? [])
        .map((c) => toRing(c.points))
        .filter((r) => r.length >= 4),
    ];

    const clipperGeoms = clipShapes.map((shape) => [
      toRing(shape.points),
      ...(shape.cuts ?? [])
        .map((c) => toRing(c.points))
        .filter((r) => r.length >= 4),
    ]);

    const result = polygonClipping.difference([subjectGeom], clipperGeoms);

    if (!result || result.length === 0) {
      return { points: [], cuts: [], pieces: [], consumed: true };
    }

    // One piece per disjoint result polygon, largest first. Existing cut
    // metadata is reconciled per piece (a pre-existing cut may end up in
    // any of them).
    const pieces = result
      .map((polygonDef) => ({
        polygonDef,
        area: Math.abs(ringSignedArea(polygonDef[0])),
      }))
      .sort((a, b) => b.area - a.area)
      .map(({ polygonDef }) => {
        const points = fromRing(polygonDef[0]);
        const cutsRaw = polygonDef.slice(1).map((ring, index) => ({
          id: nanoid(),
          label: `Cut ${index + 1}`,
          points: fromRing(ring),
        }));
        return {
          points,
          cuts: reconcileCuts(drawnShape.cuts ?? [], cutsRaw),
        };
      });

    return {
      points: pieces[0].points,
      cuts: pieces[0].cuts,
      pieces,
      consumed: false,
    };
  } catch (err) {
    console.error("avoidVisibleAnnotationsService error:", err);
    return original;
  }
}
