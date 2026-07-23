import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import slideProfileLineAlongGuide from "Features/elevation/utils/slideProfileLineAlongGuide";

// Commits the 2D drag of a WHOLE profileLine: the profile SLIDES ALONG the
// guide polyline (its crossing point follows the contour, arcs included)
// while staying NORMAL to the guide's local tangent — same math as the
// transient preview (see slideProfileLineAlongGuide). `deltaPos` is the raw
// drag delta in image px.
export default async function moveProfileLineService({
  annotationId,
  profileIndex,
  deltaPos,
  dispatch,
}) {
  if (!annotationId || !Number.isInteger(profileIndex) || !deltaPos) return;

  const ann = await db.annotations.get(annotationId);
  const line = ann?.profileLines?.[profileIndex];
  const profileRefs = (line?.points ?? []).filter((r) => r?.pointId);
  if (profileRefs.length < 2) return;

  const baseMapRecord = await db.baseMaps.get(ann.baseMapId);
  const imageSize = baseMapRecord?.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return;

  const toPx = (row) =>
    Number.isFinite(row?.x) && Number.isFinite(row?.y)
      ? { x: row.x * imageSize.width, y: row.y * imageSize.height }
      : null;

  // guide (the annotation's own chain) in px, keeping arc control types
  const guideRefs = (ann.points ?? []).filter((r) => r?.id);
  const guideRows = await db.points.bulkGet(guideRefs.map((r) => r.id));
  const guidePts = guideRefs
    .map((ref, i) => {
      const px = toPx(guideRows[i]);
      return px ? { ...px, type: ref.type } : null;
    })
    .filter(Boolean);

  const profileRows = await db.points.bulkGet(
    profileRefs.map((r) => r.pointId)
  );
  const profilePts = profileRows.map(toPx);
  if (profilePts.some((p) => !p)) return;

  const newPositions = slideProfileLineAlongGuide({
    guidePoints: guidePts,
    closeLine: !!ann.closeLine,
    profilePoints: profilePts,
    deltaPos,
  });
  if (!newPositions || newPositions.length !== profileRefs.length) return;

  await db.transaction("rw", db.points, async () => {
    for (let i = 0; i < profileRefs.length; i += 1) {
      await db.points.update(profileRefs[i].pointId, {
        x: newPositions[i].x / imageSize.width,
        y: newPositions[i].y / imageSize.height,
      });
    }
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
