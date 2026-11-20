import { withUndoGroup } from "App/db/undoManager";

import commitAnnotationsTransform2d from "Features/annotationTransform/services/commitAnnotationsTransform2d";

import getAlignDeltas from "../utils/getAlignDeltas";

// Deltas closer than this (px) are written as one move.
const DELTA_KEY_PRECISION = 1e4;

function getDeltaKey({ x, y }) {
  return `${Math.round(x * DELTA_KEY_PRECISION)}|${Math.round(y * DELTA_KEY_PRECISION)}`;
}

// Aligns `targets` (resolved annotations, px) on `mode`: one 2D « Déplacer »
// commit per distinct translation, the whole alignment being ONE undo step.
// `allAnnotations` is the full resolved list of the editor (shared-point
// detection of commitWrapperTransform: a vertex shared with an annotation
// that does not follow the same translation is forked).
// Returns the number of moved annotations.
export default async function alignAnnotationsService({
  targets,
  allAnnotations,
  mode,
  imageSize,
  meterByPx,
  projectId,
  dispatch,
}) {
  if (!imageSize) return 0;
  const deltas = getAlignDeltas({ annotations: targets, mode });
  if (!deltas.size) return 0;

  const groups = new Map();
  deltas.forEach((deltaPx, annotationId) => {
    const key = getDeltaKey(deltaPx);
    if (!groups.has(key)) groups.set(key, { deltaPx, annotationIds: [] });
    groups.get(key).annotationIds.push(annotationId);
  });

  await withUndoGroup(async () => {
    // Annotations moved by a previous group no longer reference the points
    // they shared with the next ones (forked by their commit): leaving their
    // stale resolved rows in the list would fork those points a second time.
    const movedIds = new Set();
    for (const { deltaPx, annotationIds } of groups.values()) {
      await commitAnnotationsTransform2d({
        annotationIds,
        allAnnotations: (allAnnotations ?? []).filter(
          (a) => !movedIds.has(a.id)
        ),
        transform: { kind: "MOVE", deltaPx },
        imageSize,
        meterByPx,
        projectId,
        dispatch,
      });
      annotationIds.forEach((id) => movedIds.add(id));
    }
  });

  return deltas.size;
}
