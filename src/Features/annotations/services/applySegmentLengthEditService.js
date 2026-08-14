import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";

import db from "App/db/db";

import computeSegmentLengthEdit from "../utils/computeSegmentLengthEdit";

// Apply a typed segment length on a POLYLINE / POLYGON / STRIP contour.
//
// `annotation` is the RESOLVED annotation (pixel points, each carrying its
// db.points id). The geometry is decided by computeSegmentLengthEdit; this
// service only turns the resulting pixel positions into NORMALIZED db.points
// rows — writing pixels here would send the contour off-screen on the next
// read (see docs/annotations/POINTS_STORAGE.md).
//
// The reference image size is resolved here from the base-map records rather
// than plumbed down as a prop: the renderer would have to carry a live query
// on every frame for a value only needed on commit.
//
// Same commit semantics as a vertex drag (handlePointMoveCommit):
// - a shared db.points row moves every annotation referencing it;
// - rotation metadata referencing a moved point is baked in and cleared;
// - openings glued on a moved vertex are reflowed afterwards.
export default async function applySegmentLengthEditService({
  annotation,
  closed = false,
  segmentIndex,
  targetMeters,
  meterByPx,
  lockedSegmentIndexes = new Set(),
  lockedPointIndexes = new Set(),
  dispatch,
}) {
  const points = annotation?.points;
  if (!points?.length) return { ok: false, reason: "INVALID_INPUT" };
  if (!annotation?.baseMapId) return { ok: false, reason: "INVALID_INPUT" };
  if (!Number.isFinite(meterByPx) || meterByPx <= 0)
    return { ok: false, reason: "INVALID_INPUT" };
  if (!Number.isFinite(targetMeters) || targetMeters <= 0)
    return { ok: false, reason: "INVALID_INPUT" };

  const baseMapRecord = await db.baseMaps.get(annotation.baseMapId);
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(annotation.baseMapId)
    .toArray();
  const imageSize = getBaseMapImageSizeFromRecord(baseMapRecord, versions);
  if (!imageSize?.width || !imageSize?.height)
    return { ok: false, reason: "INVALID_INPUT" };

  const result = computeSegmentLengthEdit({
    points,
    closed,
    segmentIndex,
    targetPx: targetMeters / meterByPx,
    lockedSegmentIndexes,
    lockedPointIndexes,
  });
  if (!result.ok) return result;
  if (!result.moves.length) return { ok: true };

  const updates = result.moves
    .map(({ index, x, y }) => {
      const pointId = points[index]?.id;
      if (!pointId) return null;
      return {
        key: pointId,
        changes: {
          x: x / imageSize.width,
          y: y / imageSize.height,
        },
      };
    })
    .filter(Boolean);
  if (!updates.length) return { ok: true };

  const movedPointIds = updates.map((u) => u.key);
  const movedIdsSet = new Set(movedPointIds);

  // Moving a vertex "bakes in" the rotation for that point, so rotation
  // metadata referencing any moved point is no longer valid and must be
  // cleared — on every annotation of the base map, since shared point ids
  // can drag other annotations along.
  const baseMapAnns = await db.annotations
    .where("baseMapId")
    .equals(annotation.baseMapId)
    .toArray();
  const rotatedAnns = baseMapAnns.filter((ann) => {
    if (!ann.rotation && !ann.rotationCenter) return false;
    const inMain = ann.points?.some((pt) => movedIdsSet.has(pt?.id));
    const inCuts = ann.cuts?.some((cut) =>
      cut.points?.some((pt) => movedIdsSet.has(pt?.id))
    );
    return inMain || inCuts;
  });

  await db.transaction("rw", db.points, db.annotations, async () => {
    const ops = [db.points.bulkUpdate(updates)];
    for (const ann of rotatedAnns) {
      ops.push(
        db.annotations.update(ann.id, { rotation: 0, rotationCenter: null })
      );
    }
    await Promise.all(ops);
  });

  dispatch?.(triggerAnnotationsUpdate());

  // Reposition openings anchored on a moved vertex (glued openings follow
  // their host wall) + refresh their carve. Fire-and-forget like the vertex
  // drag path.
  if (annotation.projectId) {
    try {
      await reflowOpeningsForHost({
        movedPointIds,
        projectId: annotation.projectId,
        imageSize,
        meterByPx,
      });
    } catch (e) {
      console.error("[openings] reflow failed", e);
    }
  }

  return { ok: true };
}
