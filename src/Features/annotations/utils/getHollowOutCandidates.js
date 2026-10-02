import polygonClipping from "polygon-clipping";

import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

import getAnnotationBBox from "./getAnnotationBbox";

// Same tessellation as avoidVisibleAnnotationsService / getAnnotationAsPolygons.
const ARC_SAMPLES = 16;
// bbox pre-filter tolerance, px
const TOL = 2;

const toRing = (points) => {
  if (!points || points.length === 0) return [];
  const ring = points.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
};

const toGeom = (shape, expandArcs) => [
  toRing(
    expandArcs ? expandArcsInPath(shape.points, ARC_SAMPLES, true) : shape.points
  ),
  ...(shape.cuts ?? [])
    .map((c) =>
      toRing(
        expandArcs
          ? expandArcsInPath(c.points ?? [], ARC_SAMPLES, true)
          : c.points
      )
    )
    .filter((r) => r.length >= 4),
];

/**
 * Annotations whose footprint actually carves the given POLYGON ("Evider"):
 * visible POLYGON / POLYLINE / STRIP of the same base map (the annotation
 * itself excluded), bbox pre-filter, then a real footprint ∩ polygon test —
 * a polyline without thickness has no footprint and never cuts.
 *
 * Pure: `annotation` and `visibleAnnotations` are pixel-resolved
 * (useAnnotationsV2).
 *
 * @param {Object} args
 * @param {Object} args.annotation
 * @param {Array<Object>} args.visibleAnnotations
 * @param {Object} args.baseMap   for meterByPx (CM stroke widths)
 * @returns {Array<Object>}
 */
export default function getHollowOutCandidates({
  annotation,
  visibleAnnotations,
  baseMap,
}) {
  if (!annotation?.points || annotation.points.length < 3) return [];

  const shape = { points: annotation.points, cuts: annotation.cuts ?? [] };
  // The bbox must be the contour's, whatever the annotation type says.
  const shapeBbox = getAnnotationBBox(shape);
  if (!shapeBbox) return [];

  const meterByPx = baseMap?.getMeterByPx?.();
  let subjectGeom = null;

  return (visibleAnnotations ?? []).filter((a) => {
    if (!a || a.id === annotation.id) return false;
    if (a.baseMapId !== annotation.baseMapId) return false;
    if (!["POLYGON", "POLYLINE", "STRIP"].includes(a.type)) return false;

    const footprints = getAnnotationAsPolygons(a, { meterByPx }).filter(
      (s) => s?.points?.length >= 3
    );
    if (footprints.length === 0) return false;

    // bbox pre-filter on the FOOTPRINT (a wide band can overlap the polygon
    // while its centerline stays outside).
    const overlapsBbox = footprints.some((s) => {
      const bb = getAnnotationBBox({ points: s.points });
      return (
        bb &&
        bb.x + bb.width >= shapeBbox.x - TOL &&
        bb.x <= shapeBbox.x + shapeBbox.width + TOL &&
        bb.y + bb.height >= shapeBbox.y - TOL &&
        bb.y <= shapeBbox.y + shapeBbox.height + TOL
      );
    });
    if (!overlapsBbox) return false;

    try {
      if (!subjectGeom) subjectGeom = toGeom(shape, true);
      const inter = polygonClipping.intersection(
        [subjectGeom],
        footprints.map((s) => toGeom(s, false))
      );
      return inter.length > 0;
    } catch (e) {
      // Degenerate geometry: keep the candidate, the carve service has its
      // own guard and falls back to the original shape.
      console.error("getHollowOutCandidates error:", e);
      return true;
    }
  });
}
