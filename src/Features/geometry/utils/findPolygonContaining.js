import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";

// Returns the innermost POLYGON annotation whose contour contains `localPos`
// while no cut/hole of that polygon contains it. Used by the ADD_INNER_POINT
// drawing mode: a click on the visible filled area of a polygon (not on a
// hole) should add an inner point to that polygon.
//
// Inputs: `localPos` is in resolved annotation pixel space (same space as
// `annotation.points[i].{x,y}` after useAnnotationsV2). `annotations` is the
// resolved list from useAnnotationsV2.
//
// Innermost = smallest planar bounding-box area among matching polygons. This
// is a heuristic that picks the most specific polygon when nested polygons
// overlap (e.g. a small polygon drawn on top of a larger one). Cheap to
// compute and good enough for hand-drawn floor plans.
export default function findPolygonContaining(localPos, annotations) {
  if (!localPos || !Array.isArray(annotations)) return null;

  let best = null;
  let bestBboxArea = Infinity;

  for (const ann of annotations) {
    if (ann?.type !== "POLYGON") continue;
    const contour = ann.points;
    if (!Array.isArray(contour) || contour.length < 3) continue;

    if (!pointInPolygon(localPos, contour)) continue;

    const inAnyCut = (ann.cuts || []).some(
      (c) => Array.isArray(c?.points) && c.points.length >= 3 && pointInPolygon(localPos, c.points)
    );
    if (inAnyCut) continue;

    const bboxArea = contourBboxArea(contour);
    if (bboxArea < bestBboxArea) {
      best = ann;
      bestBboxArea = bboxArea;
    }
  }

  return best;
}

function contourBboxArea(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return (maxX - minX) * (maxY - minY);
}
