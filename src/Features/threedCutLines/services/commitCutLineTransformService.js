import db from "App/db/db";
import { setSelectedPointIds } from "Features/selection/selectionSlice";
import {
  clearPendingDimensionPatch,
  setPendingDimensionPatch,
} from "Features/threedDimensions/services/dimensionPendingPatchStore";
import { clearSubSelection } from "Features/threedEditor/threedEditorSlice";

import getTransformedCutLineDrawn from "../js/getTransformedCutLineDrawn";
import { getCutLineEntry } from "./cutLineObjectsStore";
import {
  commitCutLineRebuild,
  computeCutLineRebuild,
} from "./rebuildCutLineService";

// Commit of « Déplacer » / « Tourner » on a cut line (Maillage module —
// the 3D tools of Features/threedAnnotationMove): same treatment as the
// segment drag (useCutLineTranslateHandlers) — the drawn points are
// transformed as they are (no re-projection on the faces), the extension is
// run again on the scene (rebuildCutLineService), the dropped line is
// published to dimensionPendingPatchStore BEFORE the DB write (no snap-back
// frame). One undo step.
//   - transform: in the host base map group's LOCAL frame
//     (transformCutLinePoints): { kind: "MOVE", delta } |
//     { kind: "ROTATE", pivot, phi };
//   - baseMap: the host base map row.
// Returns true when the line was written, false when the drop is refused
// (stale line, a point off the base map) — the caller puts the line back.
export default async function commitCutLineTransformService({
  editor,
  annotationId,
  baseMap,
  transform,
  dispatch,
}) {
  const entry = getCutLineEntry(annotationId);
  const group = editor?.sceneManager?.imagesManager?.getGroup?.(baseMap?.id);
  if (!entry || !group || !baseMap) return false;

  const raw = await db.annotations.get(annotationId);
  const points = getTransformedCutLineDrawn({ entry, group, raw, transform });
  if (!points) {
    console.warn("[threedCutLines] transform ignored: stale line");
    return false;
  }
  const result = computeCutLineRebuild({
    raw,
    drawn: points.drawn,
    baseMap,
    editor,
    oldDerived: points.oldDerived,
  });
  if (!result) {
    console.warn("[threedCutLines] transform ignored: off the base map");
    return false;
  }

  setPendingDimensionPatch(annotationId, {
    baseUpdatedAt: raw?.updatedAt ?? null,
    patch: result.patch,
  });
  // Every point got a new row: a sub-selected vertex is gone.
  dispatch?.(setSelectedPointIds([]));
  dispatch?.(clearSubSelection());
  try {
    await commitCutLineRebuild({
      annotationId,
      pointRows: result.pointRows,
      patch: result.patch,
    });
  } catch (err) {
    clearPendingDimensionPatch(annotationId);
    throw err;
  }
  return true;
}
