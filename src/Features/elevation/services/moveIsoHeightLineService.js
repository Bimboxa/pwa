import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import {
  getAnnotationContourRingsPx,
  projectPointOnContourRings,
} from "Features/annotations/utils/getAnnotationContourRingsPx";

// After a translation the endpoints must glue back onto the contour (the 3D
// partition needs them there). Generous tolerance: a drag along the axis can
// pull them noticeably off slanted contour edges.
const REPROJECT_TOL_PX = 40;

// Applies an elevation-panel drag to one isoHeightLine: sets its height and
// translates its PLAN points by `planDelta` (image px), then re-projects the
// two endpoints onto the contour rings.
export default async function moveIsoHeightLineService({
  annotationId,
  index,
  height, // meters — new line height
  planDelta, // { dx, dy } in image px (0 for a pure height drag)
  dispatch,
}) {
  if (!annotationId || !Number.isInteger(index) || index < 0) return;
  const ann = await db.annotations.get(annotationId);
  const line = ann?.isoHeightLines?.[index];
  if (!line) return;
  const baseMapRecord = await db.baseMaps.get(ann.baseMapId);
  const imageSize = baseMapRecord?.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return;

  const dx = Number(planDelta?.dx) || 0;
  const dy = Number(planDelta?.dy) || 0;
  const hasTranslation = Math.hypot(dx, dy) > 1e-9;

  const isoHeightLines = ann.isoHeightLines.map((l, i) =>
    i === index ? { ...l, height: Number(height) || 0 } : l
  );

  let pointUpdates = [];
  if (hasTranslation) {
    const ids = (line.points || []).map((p) => p.pointId).filter(Boolean);
    const rows = await db.points.bulkGet(ids);
    const rings = await getAnnotationContourRingsPx(ann, imageSize);
    pointUpdates = rows
      .map((row, i) => {
        if (!row) return null;
        let px = {
          x: row.x * imageSize.width + dx,
          y: row.y * imageSize.height + dy,
        };
        const isEndpoint = i === 0 || i === rows.length - 1;
        if (isEndpoint) {
          px = projectPointOnContourRings(px, rings, REPROJECT_TOL_PX);
        }
        return {
          id: row.id,
          x: px.x / imageSize.width,
          y: px.y / imageSize.height,
        };
      })
      .filter(Boolean);
  }

  await db.transaction("rw", db.points, db.annotations, async () => {
    for (const u of pointUpdates) {
      await db.points.update(u.id, { x: u.x, y: u.y });
    }
    await db.annotations.update(annotationId, { isoHeightLines });
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
