import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Inserts a new interior vertex into a profileLine at parameter `t` of
// segment `segIndex` (between refs segIndex and segIndex + 1). The plan
// position is interpolated between the two neighbor db.points; the inline
// `height` (meters) is provided by the caller (typically the interpolated
// section height at the click).
export default async function insertProfileVertexService({
  annotationId,
  profileIndex,
  segIndex,
  t,
  height, // meters
  dispatch,
}) {
  if (
    !annotationId ||
    !Number.isInteger(profileIndex) ||
    !Number.isInteger(segIndex) ||
    !Number.isFinite(t)
  ) {
    return;
  }

  const annotation = await db.annotations.get(annotationId);
  const line = annotation?.profileLines?.[profileIndex];
  const refA = line?.points?.[segIndex];
  const refB = line?.points?.[segIndex + 1];
  if (!refA?.pointId || !refB?.pointId) return;

  const [rowA, rowB] = await db.points.bulkGet([refA.pointId, refB.pointId]);
  if (!rowA || !rowB) return;

  const tc = Math.max(0.001, Math.min(0.999, t));
  const newPoint = {
    id: nanoid(),
    x: rowA.x + (rowB.x - rowA.x) * tc,
    y: rowA.y + (rowB.y - rowA.y) * tc,
    projectId: annotation.projectId,
    baseMapId: annotation.baseMapId,
    listingId: annotation.listingId,
  };

  const newRef = {
    pointId: newPoint.id,
    type: "square",
    height: Number(height) || 0,
  };
  const profileLines = annotation.profileLines.map((l, i) =>
    i === profileIndex
      ? {
          ...l,
          points: [
            ...l.points.slice(0, segIndex + 1),
            newRef,
            ...l.points.slice(segIndex + 1),
          ],
        }
      : l
  );

  await db.transaction("rw", db.points, db.annotations, async () => {
    await db.points.add(newPoint);
    await db.annotations.update(annotationId, { profileLines });
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
  return segIndex + 1; // index of the created vertex
}
