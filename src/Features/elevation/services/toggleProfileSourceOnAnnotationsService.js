import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import applyProfileFromAnnotationService from "./applyProfileFromAnnotationService";
import deleteProfileLinesService from "./deleteProfileLinesService";

// Check-box semantics of a profile tile in the « Forme par défaut » menu
// (MenuSectionProfileTiles) for one or several host annotations:
//   - every POLYLINE host already carries a profile line generated from the
//     source (`profileLines[i].sourceAnnotationId`) → those lines are REMOVED
//     (deleteProfileLinesService);
//   - otherwise the source is APPLIED on the hosts that lack it
//     (applyProfileFromAnnotationService, seed segment 0 — same as the
//     « Ajouter un profil » menu); hosts that already have it are left as is.
// POLYLINE hosts only (the apply service's contract); the source itself is
// never a host. One undo group, one Redux refresh.
//
// Returns { applied, removed, failed } counts (failed = degenerate geometry).
export default async function toggleProfileSourceOnAnnotationsService({
  annotationIds,
  sourceAnnotationId,
  dispatch,
}) {
  const result = { applied: 0, removed: 0, failed: 0 };
  const ids = [...new Set((annotationIds ?? []).filter(Boolean))].filter(
    (id) => id !== sourceAnnotationId
  );
  if (!ids.length || !sourceAnnotationId) return result;

  const hosts = (await db.annotations.bulkGet(ids)).filter(
    (a) => a && !a.deletedAt && a.type === "POLYLINE"
  );
  if (!hosts.length) return result;

  const indicesOf = (ann) =>
    (ann.profileLines ?? [])
      .map((line, i) =>
        line?.sourceAnnotationId === sourceAnnotationId ? i : -1
      )
      .filter((i) => i >= 0);
  const allHaveIt = hosts.every((a) => indicesOf(a).length > 0);

  await withUndoGroup(async () => {
    for (const ann of hosts) {
      const indices = indicesOf(ann);
      if (allHaveIt) {
        if (await deleteProfileLinesService({ annotationId: ann.id, indices }))
          result.removed += 1;
        continue;
      }
      if (indices.length) continue;
      const idx = await applyProfileFromAnnotationService({
        annotationId: ann.id,
        sourceAnnotationId,
        seedSegmentIndex: 0,
      });
      if (Number.isInteger(idx)) result.applied += 1;
      else result.failed += 1;
    }
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
  return result;
}
