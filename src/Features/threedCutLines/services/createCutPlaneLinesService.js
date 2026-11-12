import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import buildCoteAnnotationFields from "Features/threedDrawing/utils/buildCoteAnnotationFields";
import dedupeAdjacentVertices from "Features/threedDrawing/utils/dedupeAdjacentVertices";
import resolveHostBaseMap from "Features/threedDrawing/utils/resolveHostBaseMap";

import encodeCutLineRefs from "../utils/encodeCutLineRefs";

// « Plan de coupe »: writes the candidate cut lines (computeCutPlaneLines —
// world polylines, a closed one repeats its first point) as CUT_LINE
// annotations. Every point is a DRAWN point (no extension: the line already
// is the whole section of the faces it lies on). Same model as
// commitDrawnCutLineService: host base map, one db.points row per vertex
// (never shared), refs { id, offsetBottom }.
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

  const now = new Date().toISOString();
  const newPoints = [];
  const newAnnotations = [];

  for (const line of lines) {
    const host = resolveHostBaseMap({
      vertices: line.points,
      baseMaps,
      preferredBaseMapId,
    });
    const projected = host
      ? line.points.map((p) => worldToBaseMapNormalized(p, host))
      : null;
    if (!projected || projected.some((p) => !p)) {
      result.skippedCount += 1;
      continue;
    }
    const { offsetZ, points } = encodeCutLineRefs(projected);
    // Adjacent duplicates only: the closing point of a closed line is kept.
    const vertices = dedupeAdjacentVertices(points);
    if (vertices.length < 2) {
      result.skippedCount += 1;
      continue;
    }

    const refs = vertices.map((p) => {
      const id = nanoid();
      newPoints.push({
        id,
        x: p.x,
        y: p.y,
        projectId,
        baseMapId: host.id,
      });
      return { id, offsetBottom: p.offsetBottom ?? 0 };
    });

    newAnnotations.push({
      id: nanoid(),
      projectId,
      scopeId: scopeId ?? null,
      listingId: null,
      isTemplateless: true,
      baseMapId: host.id,
      ...(layerId ? { layerId } : {}),
      points: refs,
      createdAt: now,
      updatedAt: now,
      ...buildCoteAnnotationFields({
        shape: "CUT_LINE",
        classificationFields: { type: "CUT_LINE", offsetZ, height: 0 },
        templateProps: props,
      }),
      isDrawnIn3d: true,
    });
  }
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
