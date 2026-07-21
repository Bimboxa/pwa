import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Moves ONE interior profileLine vertex: inline `height` (meters) and/or its
// PLAN position (pixels, normalized against the basemap image size before
// writing to db.points). Used by the free 2-axis drag in the elevation
// profile-section editor — X slides the vertex along the profile path in
// plan, Y edits its height. Endpoints are contour-anchored: ignored here.
export default async function moveProfileVertexService({
  annotationId,
  profileIndex,
  vertexIndex,
  height, // meters
  planPos = null, // { x, y } in image px
  dispatch,
}) {
  if (
    !annotationId ||
    !Number.isInteger(profileIndex) ||
    !Number.isInteger(vertexIndex)
  ) {
    return;
  }

  const annotation = await db.annotations.get(annotationId);
  const line = annotation?.profileLines?.[profileIndex];
  const ref = line?.points?.[vertexIndex];
  if (!ref?.pointId) return;
  // POLYGON endpoints are continuity-locked; POLYLINE (extrusion) endpoints
  // are free cross-section vertices.
  if (
    annotation.type === "POLYGON" &&
    (vertexIndex === 0 || vertexIndex === line.points.length - 1)
  ) {
    return;
  }

  let normalized = null;
  if (planPos && Number.isFinite(planPos.x) && Number.isFinite(planPos.y)) {
    const baseMapRecord = await db.baseMaps.get(annotation.baseMapId);
    const imageSize = baseMapRecord?.image?.imageSize;
    if (imageSize?.width && imageSize?.height) {
      normalized = {
        x: planPos.x / imageSize.width,
        y: planPos.y / imageSize.height,
      };
    }
  }

  const h = Number(height) || 0;
  const profileLines = annotation.profileLines.map((l, i) =>
    i === profileIndex
      ? {
          ...l,
          points: l.points.map((r, j) =>
            j === vertexIndex ? { ...r, height: h } : r
          ),
        }
      : l
  );

  await db.transaction("rw", db.points, db.annotations, async () => {
    if (normalized) await db.points.update(ref.pointId, normalized);
    await db.annotations.update(annotationId, { profileLines });
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
