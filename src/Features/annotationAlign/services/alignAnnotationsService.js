import { withUndoGroup } from "App/db/undoManager";

import commitAnnotationsTransform2d from "Features/annotationTransform/services/commitAnnotationsTransform2d";

import getAlignDeltas from "../utils/getAlignDeltas";
import getAlignMoveBatches from "../utils/getAlignMoveBatches";

// Aligns `targets` (resolved annotations, px) on `mode`: every annotation is
// carried by its own translation in ONE 2D « Déplacer » commit (single write,
// single annotations update), the whole alignment being ONE undo step. Only
// targets sharing a vertex they move differently are written in successive
// commits (getAlignMoveBatches).
// `allAnnotations` is the full resolved list of the editor (shared-point
// detection of commitWrapperTransform: a vertex shared with an annotation
// that is not carried by the same commit is forked).
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

  const batches = getAlignMoveBatches({ annotations: targets, deltas });

  await withUndoGroup(async () => {
    // Annotations moved by a previous batch no longer reference the points
    // they shared with the next ones (forked by their commit): leaving their
    // stale resolved rows in the list would fork those points a second time.
    const movedIds = new Set();
    for (const annotationIds of batches) {
      await commitAnnotationsTransform2d({
        annotationIds,
        allAnnotations: movedIds.size
          ? (allAnnotations ?? []).filter((a) => !movedIds.has(a.id))
          : allAnnotations,
        transform: { kind: "MOVE", deltaPxByAnnotationId: deltas },
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
