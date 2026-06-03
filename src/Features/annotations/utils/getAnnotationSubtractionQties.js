import polygonClipping from "polygon-clipping";

import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";

// Closed ring [[x,y],...,[x0,y0]] from pixel-resolved points.
const toRing = (points) => {
  if (!points || points.length === 0) return [];
  const ring = points.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
};

const ringAbsArea = (ring) => {
  let s = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
};

// Net area (px²) of a polygon-clipping MultiPolygon: Σ (outer − holes).
const multiPolygonAreaPx = (multiPolygon) => {
  let area = 0;
  for (const polygon of multiPolygon) {
    if (!polygon || polygon.length === 0) continue;
    area += ringAbsArea(polygon[0]);
    for (let h = 1; h < polygon.length; h++) area -= ringAbsArea(polygon[h]);
  }
  return area;
};

const annotationToGeom = (annotation, meterByPx) => {
  // EXTRUSION_PROFILE targets carry an exact precomputed planar footprint
  // (matching the 3D swept prisms); other types polygonize on the fly.
  const shapes =
    annotation._profileFootprintShapes ||
    getAnnotationAsPolygons(annotation, { meterByPx });
  return shapes
    .filter((s) => s?.points && s.points.length >= 3)
    .map((shape) => [
      toRing(shape.points),
      ...(shape.cuts ?? [])
        .map((c) => toRing(c.points))
        .filter((r) => r.length >= 4),
    ]);
};

/**
 * Carved-surface quantities for a source annotation after subtracting the
 * footprints of its subtraction targets (2D boolean difference). Surface is the
 * planar footprint quantity, so we compute it from the polygon difference
 * rather than the 3D mesh — synchronous and robust.
 *
 * @param {Object} args
 * @param {Object} args.annotation  pixel-resolved source annotation
 * @param {Array<Object>} args.targets  pixel-resolved target annotations
 * @param {number} args.meterByPx
 * @returns {{surface:number, surfaceDeveloped:number}|null}
 */
export default function getAnnotationSubtractionQties({
  annotation,
  targets,
  meterByPx,
}) {
  if (!annotation || !meterByPx || !targets?.length) return null;

  try {
    const subject = annotationToGeom(annotation, meterByPx);
    if (subject.length === 0) return null;

    const clippers = [];
    for (const target of targets) {
      for (const geom of annotationToGeom(target, meterByPx)) {
        clippers.push(geom);
      }
    }
    if (clippers.length === 0) return null;

    const result = polygonClipping.difference(subject, ...clippers);
    if (!result) return null;

    const areaPx = multiPolygonAreaPx(result);
    const surface = areaPx * meterByPx * meterByPx;
    return { surface, surfaceDeveloped: surface };
  } catch (e) {
    console.error("[getAnnotationSubtractionQties] difference failed", e);
    return null;
  }
}
