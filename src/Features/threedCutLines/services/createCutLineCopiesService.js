import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import getTransformedCutLineDrawn from "../js/getTransformedCutLineDrawn";
import { getCutLineEntry } from "./cutLineObjectsStore";
import { computeCutLineRebuild } from "./rebuildCutLineService";

// « Copie multiple » of « Déplacer » / « Tourner » on a cut line (Maillage
// module): `count` new CUT_LINE annotations, copy i transformed i times
// (transformCutLinePoints — i × the delta, or i × the angle about the
// pivot). Each copy is built like a dropped line: its drawn points get
// fresh db.points rows and the extension is run on the scene for it
// (rebuildCutLineService). The source line is left untouched. A copy with a
// point off the base map is skipped.
// One undo step: a single withUndoGroup around a single transaction.
// Returns { newAnnotationIds, skippedCount }.
export default async function createCutLineCopiesService({
  editor,
  annotationId,
  baseMap,
  transform,
  count,
  dispatch,
}) {
  const result = { newAnnotationIds: [], skippedCount: 0 };
  const entry = getCutLineEntry(annotationId);
  const group = editor?.sceneManager?.imagesManager?.getGroup?.(baseMap?.id);
  if (!entry || !group || !baseMap || !(count > 0)) return result;

  const raw = await db.annotations.get(annotationId);
  if (!raw?.points?.length) return result;

  const base = { ...raw };
  delete base.createdAt;
  delete base.updatedAt;
  delete base.createdByUserIdMaster;

  const newPoints = [];
  const newAnnotations = [];
  for (let i = 1; i <= count; i++) {
    const points = getTransformedCutLineDrawn({
      entry,
      group,
      raw,
      transform,
      times: i,
      keepRefs: false,
    });
    const rebuilt = points
      ? computeCutLineRebuild({
          raw,
          drawn: points.drawn,
          baseMap,
          editor,
          oldDerived: points.oldDerived,
        })
      : null;
    if (!rebuilt) {
      result.skippedCount += 1;
      continue;
    }
    newPoints.push(...rebuilt.pointRows);
    newAnnotations.push({
      ...base,
      id: nanoid(),
      points: rebuilt.patch.points,
      offsetZ: rebuilt.patch.offsetZ,
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
  return result;
}
