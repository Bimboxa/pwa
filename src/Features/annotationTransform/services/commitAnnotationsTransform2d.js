import { withUndoGroup } from "App/db/undoManager";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import commitWrapperTransform from "Features/mapEditor/services/commitWrapperTransform";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";
import { resyncBaseMapLinksForAnnotationIds } from "Features/baseMapLinks/services/resyncBaseMapLinkPlacementsService";

import db from "App/db/db";

import getTransformPointUpdates from "../utils/getTransformPointUpdates";
import getFreeTextMoveUpdates from "../utils/getFreeTextMoveUpdates";
import { isFreeTextType, isPointHolderType } from "../utils/transform2dTypes";

// Write of a 2D « Déplacer » / « Tourner »: the pixel-frame twin of
// commitAnnotationsTransformFrom3d. The new point positions land in db.points
// (normalized) through the wrapper machinery (commitWrapperTransform —
// shared-external points forked, isMesh3d meshes and painted parts carried,
// single transaction); the openings glued on the moved walls follow. The
// whole commit is ONE undo step.
//
// FREE_TEXT annotations carry no db.points: a MOVE translates their inline
// targetPoint / labelPoint (getFreeTextMoveUpdates) in the same undo group.
// A ROTATE never carries them (refused at grab time).
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

  const pointHolders = carried.filter((a) => isPointHolderType(a.type));
  const pointHolderIds = pointHolders.map((a) => a.id);
  const pointUpdates = getTransformPointUpdates({
    annotations: pointHolders,
    transform,
  });
  const freeTextUpdates =
    transform.kind === "MOVE"
      ? getFreeTextMoveUpdates({
          annotations: carried.filter((a) => isFreeTextType(a.type)),
          deltaPx: transform.deltaPx,
          imageSize,
        })
      : new Map();
  if (!pointUpdates.size && !freeTextUpdates.size) return;

  await withUndoGroup(async () => {
    if (pointUpdates.size) {
      await commitWrapperTransform({
        selectedAnnotationIds: pointHolderIds,
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
    }

    if (freeTextUpdates.size) {
      await db.transaction("rw", db.annotations, async () => {
        await Promise.all(
          [...freeTextUpdates].map(([id, updates]) =>
            db.annotations.update(id, updates)
          )
        );
      });
    }

    if (meterByPx > 0 && projectId && pointHolderIds.length) {
      try {
        await reflowOpeningsForHost({
          hostIds: pointHolderIds,
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
