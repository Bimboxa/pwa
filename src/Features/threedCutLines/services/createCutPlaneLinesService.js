import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import buildCutLineRows from "../utils/buildCutLineRows";

// « Plan de coupe »: writes the candidate cut lines (computeCutPlaneLines —
// world polylines, a closed one repeats its first point) as CUT_LINE
// annotations. Every point is a DRAWN point (no extension: the line already
// is the whole section of the faces it lies on) — rows built by
// buildCutLineRows.
//
// One undo step: every row is built in memory, then written in a single
// transaction, with a single annotations update dispatch. A line that does
// not project on a base map is skipped.
// Returns { newAnnotationIds, skippedCount }.
export default async function createCutPlaneLinesService({
  lines,
  baseMaps,
  projectId,
  scopeId = null,
  templateProps = null,
  layerId = null,
  preferredBaseMapId = null,
  dispatch,
}) {
  const result = { newAnnotationIds: [], skippedCount: 0 };
  if (!lines?.length || !baseMaps?.length || !projectId) return result;

  // The draft's `cutPlane` flag arms the command: it is not a line prop.
  const props = templateProps ? { ...templateProps } : null;
  if (props) delete props.cutPlane;

  const { newPoints, newAnnotations, skippedCount } = buildCutLineRows({
    lines,
    baseMaps,
    projectId,
    scopeId,
    templateProps: props,
    layerId,
    preferredBaseMapId,
  });
  result.skippedCount = skippedCount;
  if (!newAnnotations.length) return result;

  await withUndoGroup(async () => {
    await db.transaction("rw", db.points, db.annotations, async () => {
      await db.points.bulkAdd(newPoints);
      await db.annotations.bulkAdd(newAnnotations);
    });
  });
  result.newAnnotationIds = newAnnotations.map((a) => a.id);
  dispatch?.(triggerAnnotationsUpdate());
  console.log(
    `[threedCutLines] cut plane: ${newAnnotations.length} cut line(s) created, ${result.skippedCount} skipped`
  );
  return result;
}
