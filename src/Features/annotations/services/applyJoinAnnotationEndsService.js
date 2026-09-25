import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import applyPointsMovesService from "Features/annotations/services/applyPointsMovesService";
import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";
import duplicateAndMovePoint from "Features/mapEditor/services/duplicateAndMovePoint";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";

import db from "App/db/db";

// Persist the end moves computed by computeJoinAnnotationEnds ("Joindre").
//
// `moves` is [{ annotationId, pointId, x, y }] in PIXELS; `annotations` are the
// RESOLVED annotations of the base map (used to detect point rows shared with
// other annotations). A shared end vertex is forked first
// (duplicateAndMovePoint — fresh db.points row on this annotation only, the
// neighbours keep the original point), every other end goes through
// applyPointsMovesService (normalized bulk update + rotation reset + glued
// openings reflow). See docs/annotations/POINTS_STORAGE.md.
export default async function applyJoinAnnotationEndsService({
  moves,
  annotations,
  meterByPx,
  dispatch,
}) {
  if (!moves?.length) return { ok: true, movedCount: 0 };

  const byId = new Map((annotations || []).map((a) => [a.id, a]));

  // pointId → number of annotations referencing it (contour + cuts).
  const refCount = new Map();
  for (const a of annotations || []) {
    const ids = new Set();
    a.points?.forEach((p) => p?.id && ids.add(p.id));
    a.cuts?.forEach((cut) =>
      cut?.points?.forEach((p) => p?.id && ids.add(p.id))
    );
    ids.forEach((id) => refCount.set(id, (refCount.get(id) || 0) + 1));
  }

  let imageSize = null;
  const getImageSize = async (baseMapId) => {
    if (imageSize) return imageSize;
    const record = await db.baseMaps.get(baseMapId);
    const versions = await db.baseMapVersions
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    imageSize = getBaseMapImageSizeFromRecord(record, versions);
    return imageSize;
  };

  // Group per annotation, fork the shared vertices first.
  const inPlaceByAnnotation = new Map();
  const forkedPointIds = [];
  const forkedHostIds = new Set();
  let movedCount = 0;

  for (const move of moves) {
    const annotation = byId.get(move.annotationId);
    if (!annotation?.baseMapId || !move.pointId) continue;
    if ((refCount.get(move.pointId) || 0) > 1) {
      const size = await getImageSize(annotation.baseMapId);
      if (!size?.width || !size?.height) continue;
      const { newPointId } = await duplicateAndMovePoint({
        originalPointId: move.pointId,
        annotationId: annotation.id,
        newPos: { x: move.x, y: move.y },
        imageSize: size,
        annotations,
      });
      forkedPointIds.push(newPointId);
      forkedHostIds.add(annotation.id);
      movedCount += 1;
      continue;
    }
    const list = inPlaceByAnnotation.get(annotation.id) || [];
    list.push({ pointId: move.pointId, x: move.x, y: move.y });
    inPlaceByAnnotation.set(annotation.id, list);
  }

  for (const [annotationId, list] of inPlaceByAnnotation) {
    const annotation = byId.get(annotationId);
    const res = await applyPointsMovesService({
      annotation,
      moves: list,
      meterByPx,
      dispatch,
    });
    if (res?.ok) movedCount += list.length;
  }

  if (forkedPointIds.length) {
    dispatch?.(triggerAnnotationsUpdate());
    const host = byId.get([...forkedHostIds][0]);
    if (host?.projectId && Number.isFinite(meterByPx) && meterByPx > 0) {
      try {
        await reflowOpeningsForHost({
          movedPointIds: forkedPointIds,
          projectId: host.projectId,
          imageSize,
          meterByPx,
        });
      } catch (e) {
        console.error("[openings] reflow failed", e);
      }
    }
  }

  return { ok: true, movedCount };
}
