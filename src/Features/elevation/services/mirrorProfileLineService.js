import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

import { isUprightSectionUp } from "../utils/getProfileSectionUp";
import mirrorProfilePointsAcrossGuide from "../utils/mirrorProfilePointsAcrossGuide";

export const MIRROR_ERROR_MESSAGES = {
  ANNOTATION_MISSING: "Annotation introuvable",
  PROFILE_MISSING: "Profil introuvable",
  BASE_MAP_FRAME: "Fond de plan sans image de référence",
  GEOMETRY: "Géométrie insuffisante pour inverser le profil",
};

// « Inverser » a POLYLINE's inline profile (`profileLines[index]`): the
// profile swaps sides of its guide line — its plan vertices are reflected
// across the registering guide segment (mirrorProfilePointsAcrossGuide), the
// base point staying on the guide. The 3D sweep and the 2D band derive from
// the points, nothing else to rebuild. Toggles `mirror` on the line so a
// re-application from the source (« Actualiser », sweep refresh) keeps the
// side. One undo step. Returns { ok: true } or { error }.
export default async function mirrorProfileLineService({
  annotationId,
  index = 0,
  dispatch,
}) {
  const ann = await db.annotations.get(annotationId);
  if (!ann) return { error: "ANNOTATION_MISSING" };
  const line = ann.profileLines?.[index];
  if (!line || (line.points?.length ?? 0) < 2) {
    return { error: "PROFILE_MISSING" };
  }
  // A profile laid upright (`sectionUp`, see getProfileSectionUp) carries its
  // SIDE axis in the inline heights and its vertical in the plan chain: the
  // plan reflection below would turn it upside down. Its mirror negates the
  // heights instead — the same result as re-applying the source with the
  // `mirror` flag toggled (the registration origin stays at height 0).
  if (isUprightSectionUp(line.sectionUp)) {
    const profileLines = ann.profileLines.map((l, i) =>
      i === index
        ? {
            ...l,
            mirror: !l.mirror,
            points: l.points.map((r) =>
              r ? { ...r, height: -(Number(r.height) || 0) } : r
            ),
          }
        : l
    );
    await withUndoGroup(async () => {
      await db.annotations.update(annotationId, { profileLines });
    });
    if (dispatch) dispatch(triggerAnnotationsUpdate());
    return { ok: true };
  }

  const baseMap = await db.baseMaps.get(ann.baseMapId);
  const imageSize = baseMap?.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) {
    return { error: "BASE_MAP_FRAME" };
  }
  const toPx = (row) => ({
    x: row.x * imageSize.width,
    y: row.y * imageSize.height,
  });

  // Guide ring in pixels, arc-expanded like applyProfileFromAnnotationService
  // and the 3D sweep (the registration segment must be the same one).
  const ringRefs = (ann.points ?? []).filter((p) => p?.id);
  const ringRows = await db.points.bulkGet(ringRefs.map((p) => p.id));
  const guideRaw = ringRefs
    .map((ref, i) => {
      const row = ringRows[i];
      if (!Number.isFinite(row?.x) || !Number.isFinite(row?.y)) return null;
      return { ...toPx(row), type: ref.type };
    })
    .filter(Boolean);
  const closeLine = Boolean(ann.closeLine || ann.type === "POLYGON");
  const guidePoints = expandArcsInPath(guideRaw, 6, closeLine);
  if (guidePoints.length < 2) return { error: "GEOMETRY" };

  // Profile vertices in pixels (row ids kept for the write-back).
  const lineIds = line.points.map((r) => r?.pointId).filter(Boolean);
  const lineRows = await db.points.bulkGet(lineIds);
  const profilePoints = lineRows
    .map((row) =>
      Number.isFinite(row?.x) && Number.isFinite(row?.y)
        ? { id: row.id, ...toPx(row) }
        : null
    )
    .filter(Boolean);
  if (profilePoints.length < 2) return { error: "GEOMETRY" };

  const mirrored = mirrorProfilePointsAcrossGuide({
    guidePoints,
    closeLine,
    profilePoints,
  });
  if (!mirrored) return { error: "GEOMETRY" };

  const profileLines = ann.profileLines.map((l, i) =>
    i === index ? { ...l, mirror: !l.mirror } : l
  );

  await withUndoGroup(async () => {
    await db.transaction("rw", db.points, db.annotations, async () => {
      for (const p of mirrored) {
        await db.points.update(p.id, {
          x: p.x / imageSize.width,
          y: p.y / imageSize.height,
        });
      }
      await db.annotations.update(annotationId, { profileLines });
    });
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
  return { ok: true };
}
