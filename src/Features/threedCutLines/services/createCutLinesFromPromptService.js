import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { getTemplatelessDraft } from "Features/mapEditor/utils/startTemplatelessDraw";
import buildCoteAnnotationFields from "Features/threedDrawing/utils/buildCoteAnnotationFields";
import projectCoteEndpoints from "Features/threedDrawing/utils/projectCoteEndpoints";
import resolveHostBaseMap from "Features/threedDrawing/utils/resolveHostBaseMap";

import buildCutLineRows from "../utils/buildCutLineRows";

import createCutLineLabelAllocator from "./createCutLineLabelAllocator";

// Minimum 3D length (metres) of a cote.
const MIN_COTE_LENGTH_M = 1e-3;

// « Ligne de coupe – prompt IA »: writes the cut lines proposed by the AI
// chat (parseCutLinesPromptResult — world polylines, every point a DRAWN
// point, no extension) and the cotes setting out the points that are not
// corners, as template-less CUT_LINE / COTE annotations of the scope.
//
// One undo step: every row is built in memory, then written in a single
// transaction, with a single annotations update dispatch. A line / cote that
// does not project on a base map is skipped.
//
// The cotes own their points (no reuse of the plan's points: a batch write,
// and a set-out dimension must not follow a neighbor annotation's vertex).
//
// Returns { lineCount, coteCount, skippedCount }.
export default async function createCutLinesFromPromptService({
  lines,
  cotes,
  baseMaps,
  projectId,
  scopeId = null,
  preferredBaseMapId = null,
  dispatch,
}) {
  const result = { lineCount: 0, coteCount: 0, skippedCount: 0 };
  if (!lines?.length || !baseMaps?.length || !projectId) return result;

  const { newPoints, newAnnotations, skippedCount } = buildCutLineRows({
    lines,
    baseMaps,
    projectId,
    scopeId,
    preferredBaseMapId,
    getLabel: await createCutLineLabelAllocator({ projectId, scopeId }),
  });
  result.lineCount = newAnnotations.length;
  result.skippedCount = skippedCount;
  if (!newAnnotations.length) return result;

  const now = new Date().toISOString();
  const coteTemplateProps = { ...getTemplatelessDraft("COTE"), type: "COTE" };
  for (const { a, b } of cotes || []) {
    if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < MIN_COTE_LENGTH_M) {
      continue;
    }
    const host = resolveHostBaseMap({
      vertices: [a, b],
      baseMaps,
      preferredBaseMapId,
    });
    const projection = host ? projectCoteEndpoints({ a, b, host }) : null;
    if (!projection) {
      result.skippedCount += 1;
      continue;
    }
    const { isInPlane, offsetZ, projectedPoints } = projection;
    const refs = projectedPoints.map((p) => {
      const id = nanoid();
      newPoints.push({ id, x: p.x, y: p.y, projectId, baseMapId: host.id });
      return isInPlane ? { id } : { id, offsetBottom: p.offsetBottom };
    });
    newAnnotations.push({
      id: nanoid(),
      projectId,
      scopeId: scopeId ?? null,
      listingId: null,
      isTemplateless: true,
      baseMapId: host.id,
      points: refs,
      createdAt: now,
      updatedAt: now,
      ...buildCoteAnnotationFields({
        classificationFields: {
          type: "COTE",
          ...(isInPlane ? {} : { offsetZ }),
        },
        templateProps: coteTemplateProps,
      }),
      isDrawnIn3d: true,
    });
    result.coteCount += 1;
  }

  await withUndoGroup(async () => {
    await db.transaction("rw", db.points, db.annotations, async () => {
      await db.points.bulkAdd(newPoints);
      await db.annotations.bulkAdd(newAnnotations);
    });
  });
  dispatch?.(triggerAnnotationsUpdate());
  console.log(
    `[threedCutLines] prompt IA: ${result.lineCount} cut line(s), ${result.coteCount} cote(s) created, ${result.skippedCount} skipped`
  );
  return result;
}
