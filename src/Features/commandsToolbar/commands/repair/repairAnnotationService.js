import db from "App/db/db";

import repairAnnotationGeometry from "Features/annotations/utils/repairAnnotationGeometry";
import {
  centerlineToStripEdge,
  getStripWidthPx,
  stripEdgeToCenterline,
} from "Features/annotations/utils/convertStripPolyline";

// « Réparer la géométrie » of a resolved annotation (pixel-space points):
// repairs the contour + cuts (repairAnnotationGeometry) and writes the
// normalized points back (annotation record + db.points, which resolvePoints
// prioritizes). A STRIP is repaired on its band centerline, then its stored
// edge is re-derived.
export default async function repairAnnotationService({
  annotation,
  baseMap,
  projectId,
}) {
  if (!annotation?.points?.length) return;
  const refImageSize = baseMap?.getImageSize?.();
  if (!refImageSize) return;
  const { width: refW, height: refH } = refImageSize;

  if (annotation.type === "STRIP") {
    const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
    const Wpx = getStripWidthPx(annotation, meterByPx);
    const orientation = annotation.stripOrientation ?? 1;
    const centerline = stripEdgeToCenterline(
      annotation.points.map((p) => ({ x: p.x, y: p.y })),
      Wpx,
      orientation
    );
    const result = repairAnnotationGeometry({
      ...annotation,
      type: "POLYLINE",
      points: centerline,
      cuts: undefined,
    });
    if (!result) return;
    const edge = centerlineToStripEdge(
      result.repairedPoints.map((p) => ({ x: p.x, y: p.y })),
      Wpx,
      orientation
    );
    const records = edge.map((p) => ({
      id: p.id,
      x: p.x / refW,
      y: p.y / refH,
      projectId,
      baseMapId: annotation.baseMapId,
      listingId: annotation.listingId,
    }));
    const refs = records.map((r) => ({ id: r.id }));
    await db.transaction("rw", db.annotations, db.points, async () => {
      await db.points.bulkAdd(records);
      await db.annotations.update(annotation.id, { points: refs });
    });
    return;
  }

  const result = repairAnnotationGeometry(annotation);
  if (!result) return;
  const { repairedPoints, repairedCuts } = result;

  const normalizedPoints = repairedPoints.map((p) => ({
    ...p,
    x: p.x / refW,
    y: p.y / refH,
  }));
  const updates = { points: normalizedPoints };
  if (repairedCuts) {
    updates.cuts = repairedCuts.map((cut) => ({
      ...cut,
      points: cut.points.map((p) => ({
        ...p,
        x: p.x / refW,
        y: p.y / refH,
      })),
    }));
  }
  await db.annotations.update(annotation.id, updates);

  const allPoints = [
    ...normalizedPoints,
    ...(updates.cuts?.flatMap((c) => c.points) ?? []),
  ];
  const pointIds = allPoints.map((p) => p.id).filter(Boolean);
  if (pointIds.length === 0) return;
  const existingDbPoints = await db.points
    .where("id")
    .anyOf(pointIds)
    .toArray();
  if (existingDbPoints.length === 0) return;
  const dbPointsById = Object.fromEntries(
    existingDbPoints.map((p) => [p.id, p])
  );
  const pointUpdates = allPoints
    .filter((p) => dbPointsById[p.id])
    .map((p) => ({ ...dbPointsById[p.id], x: p.x, y: p.y }));
  await db.points.bulkPut(pointUpdates);
}
