import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

// Append a new inner (Steiner) point to a POLYGON annotation. Coordinates are
// normalized to [0..1] vs the basemap image size and stored in db.points; the
// annotation references it via {id, type, offsetBottom, offsetTop} in its
// innerPoints array, mirroring the storage shape of contour and cut points.
//
// `localPos` is in pixel space (resolved coords, same space as
// `annotation.points[i]` after useAnnotationsV2). The caller is responsible
// for validating that the position lies inside the polygon and outside any
// cut — see findPolygonContaining + the InteractionLayer drawing-mode branch.
//
// Atomic: db.points add + db.annotations update happen in a single Dexie
// transaction so a failure in either rolls both back.
export default async function createInnerPointService({ annotation, localPos, baseMap }) {
  if (!annotation || !localPos || !baseMap) return null;

  const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return null;

  const newPointId = nanoid();
  const normalized = {
    x: localPos.x / imageSize.width,
    y: localPos.y / imageSize.height,
  };

  await db.transaction("rw", db.points, db.annotations, async () => {
    await db.points.add({
      id: newPointId,
      x: normalized.x,
      y: normalized.y,
      projectId: annotation.projectId,
      baseMapId: annotation.baseMapId,
    });

    const dbAnnotation = await db.annotations.get(annotation.id);
    if (!dbAnnotation) return;

    const nextInnerPoints = [
      ...(dbAnnotation.innerPoints || []),
      { id: newPointId, type: "square", offsetBottom: 0, offsetTop: 0 },
    ];
    await db.annotations.update(annotation.id, { innerPoints: nextInnerPoints });
  });

  return newPointId;
}
