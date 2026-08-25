import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";

import db from "App/db/db";

import computeRulerLengthEdit from "../utils/computeRulerLengthEdit";

// Apply a typed segment length on a RULER chain.
//
// `annotation` is the RESOLVED annotation (pixel points, each carrying its
// db.points id). The geometry is decided by computeRulerLengthEdit; this
// service only turns the resulting pixel positions into NORMALIZED db.points
// rows — writing pixels here would send the ruler off-screen on the next read
// (see docs/annotations/POINTS_STORAGE.md).
//
// The reference image size is resolved here from the base-map records rather
// than plumbed down as a prop: the renderer would have to carry a live query
// on every frame for a value only needed on commit.
//
// One transaction + one bulk write + one triggerAnnotationsUpdate, whatever the
// number of points the "locked neighbour" translation drags along.
export default async function applyRulerSegmentLengthService({
  annotation,
  segmentIndex,
  movedPointIndex,
  targetMeters,
  meterByPx,
  lockNeighbour = false,
  dispatch,
}) {
  const points = annotation?.points;
  if (!points?.length) return;
  if (!annotation?.baseMapId) return;
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return;
  if (!Number.isFinite(targetMeters) || targetMeters <= 0) return;

  const baseMapRecord = await db.baseMaps.get(annotation.baseMapId);
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(annotation.baseMapId)
    .toArray();
  const imageSize = getBaseMapImageSizeFromRecord(baseMapRecord, versions);
  if (!imageSize?.width || !imageSize?.height) return;

  const moves = computeRulerLengthEdit({
    points,
    segmentIndex,
    movedPointIndex,
    targetPx: targetMeters / meterByPx,
    lockNeighbour,
  });
  if (!moves.length) return;

  const updates = moves
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
  if (!updates.length) return;

  await db.transaction("rw", db.points, async () => {
    await db.points.bulkUpdate(updates);
  });

  dispatch?.(triggerAnnotationsUpdate());
}
