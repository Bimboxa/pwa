import { withUndoGroup } from "App/db/undoManager";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import commitWrapperTransform from "Features/mapEditor/services/commitWrapperTransform";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";
import { resyncBaseMapLinksForAnnotationIds } from "Features/baseMapLinks/services/resyncBaseMapLinkPlacementsService";

import db from "App/db/db";
import moveMeshPaintsWithBboxHostService from "Features/meshPaint/services/moveMeshPaintsWithBboxHostService";

import getTransformPointUpdates from "../utils/getTransformPointUpdates";
import getFreeTextMoveUpdates from "../utils/getFreeTextMoveUpdates";
import getObject3DTransformUpdates from "../utils/getObject3DTransformUpdates";
import {
  isFreeTextType,
  isObject3DType,
  isPointHolderType,
} from "../utils/transform2dTypes";

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
// OBJECT_3D annotations (imported GLB, bbox + rotation) carry no db.points
// either: MOVE and ROTATE rewrite their placement fields
// (getObject3DTransformUpdates) and their painted parts follow
// (moveMeshPaintsWithBboxHostService), same undo group.
//
// transform: see getTransformPointUpdates. A MOVE may also carry each
// annotation by its OWN translation (align commands):
//   { kind: "MOVE", deltaPxByAnnotationId: Map<annotationId, {x, y}> }
// Everything is still written in one commit (one transaction per storage
// family, one openings reflow, one annotations update dispatch). The
// annotations missing from the map are left in place. The caller must not
// carry, in the same commit, two annotations sharing a point with different
// translations (see getAlignMoveBatches).
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
  const deltaPxById =
    transform.kind === "MOVE" ? transform.deltaPxByAnnotationId : null;
  const carried = (allAnnotations ?? []).filter(
    (a) =>
      annotationIds.includes(a.id) && (!deltaPxById || deltaPxById.has(a.id))
  );
  if (!carried.length) return;

  // Updates of `annotations` (Map), computed in one go for a shared
  // transform, annotation by annotation for a per-annotation MOVE.
  const collectUpdates = (annotations, getUpdates) => {
    if (!deltaPxById) return getUpdates(annotations, transform);
    const merged = new Map();
    for (const annotation of annotations) {
      const updates = getUpdates([annotation], {
        kind: "MOVE",
        deltaPx: deltaPxById.get(annotation.id),
      });
      updates.forEach((value, key) => {
        if (!merged.has(key)) merged.set(key, value);
      });
    }
    return merged;
  };

  const pointHolders = carried.filter((a) => isPointHolderType(a.type));
  const pointHolderIds = pointHolders.map((a) => a.id);
  const pointUpdates = collectUpdates(pointHolders, (annotations, t) =>
    getTransformPointUpdates({ annotations, transform: t })
  );
  const freeTextUpdates =
    transform.kind === "MOVE"
      ? collectUpdates(
          carried.filter((a) => isFreeTextType(a.type)),
          (annotations, t) =>
            getFreeTextMoveUpdates({
              annotations,
              deltaPx: t.deltaPx,
              imageSize,
            })
        )
      : new Map();
  const object3ds = carried.filter((a) => isObject3DType(a.type));
  const object3dUpdates = collectUpdates(object3ds, (annotations, t) =>
    getObject3DTransformUpdates({ annotations, transform: t, imageSize })
  );
  if (!pointUpdates.size && !freeTextUpdates.size && !object3dUpdates.size) {
    return;
  }

  await withUndoGroup(async () => {
    if (pointUpdates.size) {
      await commitWrapperTransform({
        selectedAnnotationIds: pointHolderIds,
        allAnnotations,
        pointUpdates,
        imageSize,
        rotationDelta: null,
        wrapperBbox: null,
        moveDelta:
          transform.kind === "MOVE" ? (transform.deltaPx ?? null) : null,
        moveDeltaByAnnotationId: deltaPxById ?? null,
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

    if (object3dUpdates.size) {
      const metrics =
        meterByPx > 0
          ? {
              imageWidth: imageSize.width,
              imageHeight: imageSize.height,
              meterByPx,
            }
          : null;
      await db.transaction("rw", db.annotations, db.meshPaints, async () => {
        for (const [id, { fields, affine }] of object3dUpdates) {
          await db.annotations.update(id, fields);
          await moveMeshPaintsWithBboxHostService({
            hostId: id,
            host: object3ds.find((a) => a.id === id),
            affine,
            imageSize,
            metrics,
          });
        }
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
