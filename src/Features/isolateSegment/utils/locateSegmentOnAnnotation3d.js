import { Vector3 } from "three";

import db from "App/db/db";

import { getStripWidthPx } from "Features/annotations/utils/convertStripPolyline";
import { normalizedToLocal } from "Features/annotationMesh3d/utils/mesh3dFrame";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import locatePlanPointOnPolyline from "Features/threedFaceCut/utils/locatePlanPointOnPolyline";

// Slack (m) added to the half-width: a click on the very edge of a wall face
// still lands on its segment.
const PLAN_TOL_M = 2e-2;

// Which segment of a POLYLINE / STRIP a 3D click (world point on one of its
// faces: side, top, end cap) belongs to — located in PLAN, in the base map's
// local frame, against the annotation's own points resolved from db.points.
// This ignores how the faces were built (collinear segments merged, arcs
// sampled, thick walls offset from their centerline): the nearest segment
// within the wall / band width is the one.
//
// `annotation`: RAW db row. Returns { segmentStartPointId, distance } (m) or
// null (base map not in the scene, no scale, click farther than the width).
export default async function locateSegmentOnAnnotation3d({
  editor,
  annotation,
  worldPoint,
}) {
  const imagesManager = editor?.sceneManager?.imagesManager;
  const baseMapGroup = imagesManager?.getGroup?.(annotation?.baseMapId);
  const baseMapRecord = imagesManager?.baseMapsMap?.[annotation?.baseMapId];
  const metrics = getBaseMapForRender(baseMapRecord);
  if (!baseMapGroup || !metrics || !worldPoint) return null;

  const local = baseMapGroup.worldToLocal(
    new Vector3(worldPoint.x, worldPoint.y, worldPoint.z)
  );

  const refs = annotation.points ?? [];
  const rows = await db.points.bulkGet(refs.map((ref) => ref?.id));
  const line = [];
  refs.forEach((ref, i) => {
    const row = rows[i];
    if (!row || row.deletedAt || !Number.isFinite(row.x)) return;
    line.push({ ref, ...normalizedToLocal([row.x, row.y], metrics) });
  });
  if (line.length < 2) return null;

  // tolerance -1: always a segment, never a vertex.
  const location = locatePlanPointOnPolyline(
    line,
    { x: local.x, y: local.y },
    { closeLine: annotation.closeLine === true, tolerance: -1 }
  );
  if (!location || location.segmentIndex == null) return null;

  const reach = getPlanReachM(annotation, metrics.meterByPx) + PLAN_TOL_M;
  if (location.distance > reach) return null;

  return {
    segmentStartPointId: line[location.segmentIndex].ref.id,
    distance: location.distance,
  };
}

// How far (m) a face of the annotation can sit from its points in plan: half
// the thickness of a CM wall (centerline), the full band width of a STRIP
// (its points are one EDGE of the band), 0 for a PX polyline wall.
function getPlanReachM(annotation, meterByPx) {
  if (annotation.type === "STRIP") {
    return getStripWidthPx(annotation, meterByPx) * (meterByPx || 0);
  }
  if (annotation.strokeWidthUnit === "CM") {
    return ((Number(annotation.strokeWidth) || 0) * 0.01) / 2;
  }
  return 0;
}
