import polygonClipping from "polygon-clipping";

import {
  annotationToGeom,
  getSubtractionClippers,
} from "./getAnnotationSubtractionQties";

/**
 * The holes its subtraction targets open in a FLAT polygon host
 * (isFlatPolygonSheet), for the 2D drawing: a sheet is cut through on the
 * footprint of whatever is subtracted from it, exactly what the 3D carve and
 * the surface quantity show.
 *
 * Host ∩ (union of the target footprints), so a target sticking out of the
 * host, two overlapping targets or a target over an existing cut never fill
 * anything back under the even-odd rule of the 2D fill.
 *
 * @param {Object} args
 * @param {Object} args.annotation pixel-resolved flat host
 * @param {Array<Object>} args.targets pixel-resolved targets of the SAME
 *   base map (a block instance carries `_footprintMultiPolygon`)
 * @param {number} args.meterByPx
 * @returns {Array<Array<{x: number, y: number}>>} open rings, host pixels
 */
export default function getFlatHostSubtractionHoles({
  annotation,
  targets,
  meterByPx,
}) {
  if (!annotation || !targets?.length) return [];
  try {
    const subject = annotationToGeom(annotation, meterByPx);
    if (subject.length === 0) return [];
    const clippers = getSubtractionClippers(targets, meterByPx);
    if (clippers.length === 0) return [];
    const [first, ...others] = clippers;
    const removed = polygonClipping.intersection(
      subject,
      others.length > 0 ? polygonClipping.union(first, ...others) : first
    );
    const rings = [];
    for (const polygon of removed ?? []) {
      for (const ring of polygon) {
        // polygon-clipping repeats the first point at the end of a ring.
        const points = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
        if (points.length >= 3) rings.push(points);
      }
    }
    return rings;
  } catch (e) {
    console.error("[getFlatHostSubtractionHoles] clip failed", e);
    return [];
  }
}
