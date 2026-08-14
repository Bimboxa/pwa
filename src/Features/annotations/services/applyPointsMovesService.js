import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";

import db from "App/db/db";

// Commit a batch of pixel-space point moves on an annotation's contour with
// the same semantics as a vertex drag (handlePointMoveCommit):
// - db.points rows are written NORMALIZED vs the base map image size (see
//   docs/annotations/POINTS_STORAGE.md — never inline x/y on annotation.points);
// - a shared db.points row moves every annotation referencing it;
// - rotation metadata referencing a moved point is baked in and cleared;
// - openings glued on a moved vertex are reflowed afterwards.
//
// `annotation` is the RESOLVED annotation (carries baseMapId / projectId).
// `moves` is [{ pointId, x, y }] in PIXELS.
//
// Shared by the segment-length editor and the EDIT-mode segment / vertex
// drags (angle lock).
export default async function applyPointsMovesService({
  annotation,
  moves,
  meterByPx,
  dispatch,
}) {
  if (!moves?.length) return { ok: true };
  if (!annotation?.baseMapId) return { ok: false, reason: "INVALID_INPUT" };

  const baseMapRecord = await db.baseMaps.get(annotation.baseMapId);
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(annotation.baseMapId)
    .toArray();
  const imageSize = getBaseMapImageSizeFromRecord(baseMapRecord, versions);
  if (!imageSize?.width || !imageSize?.height)
    return { ok: false, reason: "INVALID_INPUT" };

  const updates = moves
    .map(({ pointId, x, y }) => {
      if (!pointId || !Number.isFinite(x) || !Number.isFinite(y)) return null;
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
  if (annotation.projectId && Number.isFinite(meterByPx) && meterByPx > 0) {
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
