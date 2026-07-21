import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Creates a new isoHeightLine on the annotation from two PLAN pixel points
// (already on the contour — e.g. the intersections of the elevation-panel
// section with the ring) and a height (meters, offsetTop semantics).
export default async function createIsoHeightLineService({
  annotationId,
  planPoints, // [{x, y}, {x, y}] in image px
  height,
  dispatch,
}) {
  if (!annotationId || !Array.isArray(planPoints) || planPoints.length < 2) {
    return;
  }
  const ann = await db.annotations.get(annotationId);
  if (!ann) return;
  const baseMapRecord = await db.baseMaps.get(ann.baseMapId);
  const imageSize = baseMapRecord?.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return;

  const newPoints = planPoints.map((p) => ({
    id: nanoid(),
    x: p.x / imageSize.width,
    y: p.y / imageSize.height,
    projectId: ann.projectId,
    baseMapId: ann.baseMapId,
    listingId: ann.listingId,
  }));

  const prevIsoLines = Array.isArray(ann.isoHeightLines)
    ? ann.isoHeightLines
    : [];
  const newIsoLine = {
    points: newPoints.map((np) => ({ pointId: np.id, type: "square" })),
    height: Number(height) || 0,
  };

  await db.transaction("rw", db.points, db.annotations, async () => {
    for (const np of newPoints) {
      await db.points.add(np);
    }
    await db.annotations.update(annotationId, {
      isoHeightLines: [...prevIsoLines, newIsoLine],
    });
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
  return prevIsoLines.length; // index of the created line
}
