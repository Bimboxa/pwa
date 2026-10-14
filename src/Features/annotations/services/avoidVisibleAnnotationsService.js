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

// Plan circle of a DISC candidate (centre resolved in px by useAnnotationsV2,
// radius in metres through the plan scale), or null.
const getDiscCircle = (candidate, meterByPx) => {
  const mbp = candidate?._planMeterByPx ?? meterByPx;
  const radiusM = Number(candidate?.radiusM) || 0;
  if (!candidate?.point || !(mbp > 0) || !(radiusM > 0)) return null;
  return {
    center: { x: candidate.point.x, y: candidate.point.y },
    r: radiusM / mbp,
  };
};

// Circles of the band EDGES a candidate contributes to the clipped geometry:
// a POLYLINE band is centered on its centerline (edges at r ± w/2), a STRIP
// band goes from the centerline to its offset side (edges at r and r ± d),
// a POLYGON ring is its own footprint edge (r), a DISC its rim circle. These
// are the circles the carved rings' arc runs must be concentric with
// (requireSourceMatch).
const getCandidateArcCircles = (candidate, meterByPx) => {
  if (candidate.type === "DISC") {
    const circle = getDiscCircle(candidate, meterByPx);
    return { circles: circle ? [circle] : [], bandPx: 0 };
  }

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

// Minimum vertex count for a tessellated ring to be considered a full circle.
const FULL_CIRCLE_MIN_POINTS = 8;

// A result ring whose vertices ALL lie on one source circle and run a full
// turn around it (a disc / circle footprint punched through the shape) is
// replaced by the 4-point square-circle-square-circle ring the circle
// drawing tools produce (0° / 90° / 180° / 270°), in the ring's own winding.
// collapseArcsInPolyline cannot do it: its greedy scan of an open polyline
// yields at best one near-full arc + a closing chord, and its 1 px tolerance
// rejects large circles (chord sagitta > 1 px). Returns null when the ring is
// not a full source circle.
const snapFullCircleRing = (pts, sourceArcCircles) => {
  const n = pts.length;
  if (n < FULL_CIRCLE_MIN_POINTS || sourceArcCircles.length === 0) return null;

  for (const circle of sourceArcCircles) {
    if (!circle?.center || !(circle.r > 0)) continue;
    const tol = Math.max(1, 0.005 * circle.r);
    let onCircle = true;
    let turn = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const d = Math.hypot(p.x - circle.center.x, p.y - circle.center.y);
      if (Math.abs(d - circle.r) > tol) {
        onCircle = false;
        break;
      }
      const q = pts[(i + 1) % n];
      const a0 = Math.atan2(p.y - circle.center.y, p.x - circle.center.x);
      const a1 = Math.atan2(q.y - circle.center.y, q.x - circle.center.x);
      let da = a1 - a0;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      turn += da;
    }
    if (!onCircle) continue;
    // Full turn (±2π); a sector ring (centre + arc) never sums to it.
    if (Math.abs(Math.abs(turn) - 2 * Math.PI) > 1e-3) continue;

    const { center, r } = circle;
    const sign = turn > 0 ? 1 : -1;
    return [0, 1, 2, 3].map((k) => {
      const a = (sign * k * Math.PI) / 2;
      return {
        x: center.x + r * Math.cos(a),
        y: center.y + r * Math.sin(a),
        type: k % 2 === 1 ? "circle" : "square",
      };
    });
  }
  return null;
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
 * point approximations; a ring that is a whole source circle (DISC or circle
 * POLYGON punched through) becomes a 4-point S-C-S-C ring. Output points
 * carry `type: "circle"` on arc middles.
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
    ...(drawnShape.cuts ?? []).flatMap((c) =>
      extractArcCircles(c.points ?? [])
    ),
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
      const fullCircle = snapFullCircleRing(pts, sourceArcCircles);
      const typed = fullCircle
        ? fullCircle
        : sourceArcCircles.length === 0
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
