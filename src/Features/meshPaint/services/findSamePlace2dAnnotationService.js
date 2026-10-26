import db from "App/db/db";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import findSamePlaceAnnotation from "Features/meshPaint/utils/findSamePlaceAnnotation";

// Duplicate guard of the « Pinceau » 2D commit (commitMeshBrush2dService):
// before an annotation is written, look in the DATABASE (every live
// annotation of the base map, loaded in the scene or not — hidden listings
// included) for one of the same template and type at the same place
// (findSamePlaceAnnotation). The candidate comes in the db.points convention
// (normalized to the base map image); existing annotations are resolved to
// pixels like useAnnotationsV2 (resolvePoints).
//
// Returns the id of the existing annotation, or null when the plan is clear.

const skipped = (a) =>
  a.deletedAt ||
  a.isMesh3d ||
  a.isMeshCell ||
  a.isBaseMapAnnotation ||
  a.isAdjacencyOnly;

export default async function findSamePlace2dAnnotationService({
  baseMapId,
  metrics,
  annotationTemplateId,
  type,
  closeLine = false,
  normalizedPoints,
  normalizedCuts = [],
}) {
  if (!baseMapId || !metrics || !annotationTemplateId || !type) return null;
  const imageSize = { width: metrics.imageWidth, height: metrics.imageHeight };

  const rows = await db.annotations
    .where("baseMapId")
    .equals(baseMapId)
    .toArray();
  const existing = rows.filter(
    (a) =>
      !skipped(a) &&
      a.type === type &&
      a.annotationTemplateId === annotationTemplateId &&
      a.points?.length
  );
  if (!existing.length) return null;

  const pointIds = new Set();
  for (const a of existing) {
    for (const ref of a.points ?? []) if (ref?.id) pointIds.add(ref.id);
    for (const cut of a.cuts ?? [])
      for (const ref of cut?.points ?? []) if (ref?.id) pointIds.add(ref.id);
  }
  const pointRows = await db.points.bulkGet([...pointIds]);
  const pointsIndex = {};
  for (const row of pointRows) if (row) pointsIndex[row.id] = row;

  const toPx = (points) =>
    resolvePoints({ points, pointsIndex, imageSize }) ?? [];
  const resolved = existing.map((a) => ({
    ...a,
    points: toPx(a.points),
    cuts: (a.cuts ?? [])
      .filter((cut) => cut?.points?.length)
      .map((cut) => ({ ...cut, points: toPx(cut.points) })),
  }));

  const inlineToPx = (points) =>
    (points ?? []).map((p) => ({
      x: p.x * imageSize.width,
      y: p.y * imageSize.height,
      type: p.type === "circle" ? "circle" : "square",
    }));
  const candidate = {
    type,
    annotationTemplateId,
    closeLine: Boolean(closeLine),
    points: inlineToPx(normalizedPoints),
    cuts: (normalizedCuts ?? [])
      .filter((ring) => ring?.length)
      .map((ring) => ({ points: inlineToPx(ring) })),
  };

  return findSamePlaceAnnotation({
    candidate,
    annotations: resolved,
    meterByPx: metrics.meterByPx,
  });
}
