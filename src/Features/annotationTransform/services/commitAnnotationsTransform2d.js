import { withUndoGroup } from "App/db/undoManager";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import commitWrapperTransform from "Features/mapEditor/services/commitWrapperTransform";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";
import { resyncBaseMapLinksForAnnotationIds } from "Features/baseMapLinks/services/resyncBaseMapLinkPlacementsService";

import getTransformPointUpdates from "../utils/getTransformPointUpdates";

// Write of a 2D « Déplacer » / « Tourner »: the pixel-frame twin of
// commitAnnotationsTransformFrom3d. The new point positions land in db.points
// (normalized) through the wrapper machinery (commitWrapperTransform —
// shared-external points forked, isMesh3d meshes and painted parts carried,
// single transaction); the openings glued on the moved walls follow. The
// whole commit is ONE undo step.
//
// transform: see getTransformPointUpdates.
export default async function commitAnnotationsTransform2d({
  annotationIds,
  allAnnotations,
  transform,
  imageSize,
  meterByPx,
  projectId,
  dispatch,
}) {
  if (!imageSize) return;
  const carried = (allAnnotations ?? []).filter((a) =>
    annotationIds.includes(a.id)
  );
  if (!carried.length) return;

  const pointUpdates = getTransformPointUpdates({
    annotations: carried,
    transform,
  });
  if (!pointUpdates.size) return;

  await withUndoGroup(async () => {
    await commitWrapperTransform({
      selectedAnnotationIds: annotationIds,
      allAnnotations,
      pointUpdates,
      imageSize,
      rotationDelta: null,
      wrapperBbox: null,
      moveDelta: transform.kind === "MOVE" ? transform.deltaPx : null,
      // An arbitrary user-picked pivot breaks the single-center model of
      // rotation / rotationCenter — bake the rotation into the points and
      // reset the metadata (same rule as the 3D tool and vertex edits).
      clearRotation: transform.kind === "ROTATE",
    });

    if (meterByPx > 0 && projectId) {
      try {
        await reflowOpeningsForHost({
          hostIds: annotationIds,
          movedPointIds: [],
          projectId,
          imageSize,
          meterByPx,
        });
      } catch (err) {
        console.error("[annotationTransform] openings reflow failed", err);
      }
    }
  });

  dispatch(triggerAnnotationsUpdate());
  // Moved BASE_MAP_LINK marks re-pose the elevations they drive.
  await resyncBaseMapLinksForAnnotationIds({ annotationIds, dispatch });
}
