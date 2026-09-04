import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";

import db from "App/db/db";

import applyPointsMovesService from "./applyPointsMovesService";

// Apply a typed length on an OPENING annotation (door / window: 2-point
// POLYLINE with drawingShape "OPENING"). Unlike a polyline segment, the
// opening's length IS its `width` property (meters — the value used by the
// 3D carve and the quantities): the endpoints are derived from it.
//
//   - glued opening (relAnnotationOpenings row): write `width`, then reflow
//     the opening from its stored anchor — the centre stays at hostDistanceM
//     on the host curve and both jambs move symmetrically (clamped by the
//     host segment like any reflow).
//   - free opening (no host): keep p1, slide p2 along the current direction.
//
// `annotation` is the RESOLVED annotation (pixel points carrying db ids).
export default async function applyOpeningLengthEditService({
  annotation,
  targetMeters,
  meterByPx,
  dispatch,
}) {
  const points = annotation?.points;
  if (!annotation?.id || points?.length !== 2)
    return { ok: false, reason: "INVALID_INPUT" };
  if (!Number.isFinite(meterByPx) || meterByPx <= 0)
    return { ok: false, reason: "INVALID_INPUT" };
  if (!Number.isFinite(targetMeters) || targetMeters <= 0)
    return { ok: false, reason: "INVALID_INPUT" };

  const [p1, p2] = points;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return { ok: false, reason: "DEGENERATE_SEGMENT" };

  await db.annotations.update(annotation.id, { width: targetMeters });

  const rels = await db.relAnnotationOpenings
    .where("openingAnnotationId")
    .equals(annotation.id)
    .toArray();
  const rel = rels.find((r) => !r.deletedAt);

  if (rel) {
    const baseMapRecord = await db.baseMaps.get(annotation.baseMapId);
    const versions = await db.baseMapVersions
      .where("baseMapId")
      .equals(annotation.baseMapId)
      .toArray();
    const imageSize = getBaseMapImageSizeFromRecord(baseMapRecord, versions);
    if (imageSize?.width && imageSize?.height && annotation.projectId) {
      await reflowOpeningsForHost({
        hostIds: [rel.hostAnnotationId],
        openingIds: [annotation.id],
        projectId: annotation.projectId,
        imageSize,
        meterByPx,
      });
    }
    dispatch?.(triggerAnnotationsUpdate());
    return { ok: true };
  }

  // Free opening: p1 is the fixed jamb, p2 slides along the segment.
  const targetPx = targetMeters / meterByPx;
  const ux = dx / len;
  const uy = dy / len;
  return applyPointsMovesService({
    annotation,
    moves: [
      { pointId: p2.id, x: p1.x + ux * targetPx, y: p1.y + uy * targetPx },
    ],
    meterByPx,
    dispatch,
  });
}
