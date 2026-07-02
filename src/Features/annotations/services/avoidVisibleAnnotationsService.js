import { nanoid } from "@reduxjs/toolkit";
import polygonClipping from "polygon-clipping";

import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";
import reconcileCuts from "Features/geometry/utils/reconcileCuts";
import collapseArcsInPolyline from "Features/geometry/utils/collapseArcsInPolyline";
import {
  expandArcsInPath,
  extractArcCircles,
  arcUnitsToTypedPoints,
} from "Features/geometry/utils/arcSampling";
import { getStripDistancePx } from "Features/geometry/utils/getStripePolygons";

// Tessellation count for S-C-S arcs before the boolean op — matches
// getStripePolygons / getAnnotationAsPolygons.
const ARC_SAMPLES = 16;

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

// POLYLINE band width in pixels (same conversion as getAnnotationAsPolygons).
const getPolylineBandPx = (annotation, meterByPx) => {
  const strokeWidth = Number(annotation?.strokeWidth) || 0;
  if (strokeWidth <= 0) return 0;
  const isCmUnit = annotation?.strokeWidthUnit === "CM" && meterByPx > 0;
  return isCmUnit ? (strokeWidth * 0.01) / meterByPx : strokeWidth;
};

// Circles of the band EDGES a candidate contributes to the clipped geometry:
// a POLYLINE band is centered on its centerline (edges at r ± w/2), a STRIP
// band goes from the centerline to its offset side (edges at r and r ± d),
// a POLYGON ring is its own footprint edge (r). These are the circles the
// carved rings' arc runs must be concentric with (requireSourceMatch).
const getCandidateArcCircles = (candidate, meterByPx) => {
  const centerlineCircles = [
    ...extractArcCircles(candidate.points ?? []),
    ...(candidate.cuts ?? []).flatMap((c) => extractArcCircles(c.points ?? [])),
  ];
  if (centerlineCircles.length === 0) return { circles: [], bandPx: 0 };

  if (candidate.type === "POLYLINE") {
    const bandPx = getPolylineBandPx(candidate, meterByPx);
    const half = bandPx / 2;
    return {
      circles: centerlineCircles.flatMap((c) => [
        { center: c.center, r: Math.max(0, c.r - half) },
        { center: c.center, r: c.r + half },
      ]),
      bandPx,
    };
  }

  if (candidate.type === "STRIP") {
    const bandPx = Math.abs(getStripDistancePx(candidate, meterByPx));
    return {
      circles: centerlineCircles.flatMap((c) => [
        c,
        { center: c.center, r: c.r + bandPx },
        { center: c.center, r: Math.max(0, c.r - bandPx) },
      ]),
      bandPx,
    };
  }

  return { circles: centerlineCircles, bandPx: 0 };
};

/**
 * Carve `drawnShape` by subtracting every clip polygon derived from
 * `candidates`. The result naturally yields outer-contour changes
 * (overlap) and/or new cuts (full containment).
 *
 * S-C-S arcs (subject rings and candidate footprints) are tessellated into
 * chords for the boolean op, then recovered on the result rings: runs of
 * vertices concentric with a known source arc circle collapse back into a
 * square-circle-square arc, so carved edges stay true arcs instead of dense
 * point approximations. Output points carry `type: "circle"` on arc middles.
 *
 * When the subtraction splits the shape into several disjoint polygons,
 * `points`/`cuts` describe the largest piece and `pieces` lists them all
 * (largest first), each as {points, cuts}.
 *
 * @param {Object} args
 * @param {{points:Array<{id?,x,y,type?}>, cuts?:Array}} args.drawnShape
 * @param {Array<Object>} args.candidates  resolved annotations (different
 *                                         templateId, visible, bbox-overlapping)
 * @param {Object} args.baseMap            for meterByPx (CM stroke widths)
 * @returns {{points:Array<{id,x,y,type?}>, cuts:Array<{id,label?,points:Array<{id,x,y,type?}>}>, pieces:Array<{points,cuts}>, consumed:boolean}}
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
  const sourceArcCircles = [
    ...extractArcCircles(drawnShape.points),
    ...(drawnShape.cuts ?? []).flatMap((c) => extractArcCircles(c.points ?? [])),
  ];
  let arcThicknessPx = 0;
  for (const cand of candidates) {
    const shapes = getAnnotationAsPolygons(cand, { meterByPx });
    let candHasShape = false;
    for (const shape of shapes) {
      if (!shape?.points || shape.points.length < 3) continue;
      clipShapes.push(shape);
      candHasShape = true;
    }
    if (candHasShape) {
      const { circles, bandPx } = getCandidateArcCircles(cand, meterByPx);
      sourceArcCircles.push(...circles);
      if (circles.length > 0) {
        arcThicknessPx = Math.max(arcThicknessPx, bandPx);
      }
    }
  }

  if (clipShapes.length === 0) return original;

  try {
    // polygon-clipping is straight-line only: tessellate the subject's arcs
    // into chords (candidate footprints are already tessellated by
    // getAnnotationAsPolygons). Arcs are recovered after the difference.
    const subjectGeom = [
      toRing(expandArcsInPath(drawnShape.points, ARC_SAMPLES, true)),
      ...(drawnShape.cuts ?? [])
        .map((c) => toRing(expandArcsInPath(c.points ?? [], ARC_SAMPLES, true)))
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

    // Recover S-C-S arcs on a result ring. Only runs concentric with a known
    // source circle are collapsed (requireSourceMatch), so straight corners
    // never get mis-fitted as arcs.
    const ringToPoints = (ring) => {
      const pts = ring.slice(0, ring.length - 1).map((p) => ({
        x: p[0],
        y: p[1],
      }));
      const typed =
        sourceArcCircles.length === 0
          ? pts
          : arcUnitsToTypedPoints(
              collapseArcsInPolyline(pts, {
                sourceArcCircles,
                requireSourceMatch: true,
                thicknessPx: arcThicknessPx,
              })
            );
      return typed.map((p) => ({
        id: nanoid(),
        x: p.x,
        y: p.y,
        ...(p.type === "circle" && { type: "circle" }),
      }));
    };

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
        const points = ringToPoints(polygonDef[0]);
        const cutsRaw = polygonDef.slice(1).map((ring, index) => ({
          id: nanoid(),
          label: `Cut ${index + 1}`,
          points: ringToPoints(ring),
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
