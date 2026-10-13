import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { createAutoNumberLabelAllocator } from "Features/annotations/services/getNextAutoNumberLabelAsync";
import duplicateAnnotationPoints from "Features/annotations/utils/duplicateAnnotationPoints";
import applyAffineToMesh3d from "Features/annotationMesh3d/utils/applyAffineToMesh3d";
import { applyAffineToMesh3dSource } from "Features/annotationMesh3d/utils/mesh3dSource";
import { roundOffsetZ } from "Features/annotationMesh3d/utils/mesh3dFrame";
import applyDeltaPosToAnnotation from "Features/mapEditorGeneric/utils/applyDeltaPosToAnnotation";

import { getPivotBbox } from "../utils/getTransformPointUpdates";
import getFreeTextMoveUpdates from "../utils/getFreeTextMoveUpdates";
import getPixelRotationAffine from "../utils/pixelRotationAffine";
import { isFreeTextType } from "../utils/transform2dTypes";

// « Copie multiple » of the « Déplacer » / « Tourner » tools (2D and 3D): N
// transformed copies of the carried annotations, copy i at i × the
// transform, the originals untouched. Shared by the 2D commits (pixel
// frame) and the 3D ones (local metres mapped to pixels).
//
// transform:
//   { kind: "MOVE", deltaPx: {x, y}, deltaZ? }   copy i translated by
//     i × deltaPx (and i × deltaZ metres of altitude, 3D snapped drop)
//   { kind: "ROTATE", pivotPx: {x, y}, angleDeg } copy i turned by
//     i × angleDeg around the pivot (pixel space, y down: clockwise
//     positive — the convention of getTransformPointUpdates)
//
// Each copy is built from the STORED row of its source (never from the
// hydrated object of useAnnotationsV2 — template-merged props, quantities,
// `_xxx` runtime fields…), onto which only the geometry is grafted: the
// resolved pixel points are transformed (applyDeltaPosToAnnotation) and
// re-minted as fresh db.points (duplicateAnnotationPoints, one id map per
// copy so a vertex shared by two carried walls stays shared by their copies).
//
// FREE_TEXT sources (no db.points) get their inline targetPoint / labelPoint
// translated instead (getFreeTextMoveUpdates) — MOVE only, a ROTATE skips
// them (the tool never carries them in a rotation).
//
// Also carried: the isMesh3d mesh and its source snapshot (same pixel
// affine), the mapping-category rels, the active layer, the listing's
// auto-number labels. MOVE translates rotationCenter and adds i × deltaZ to
// offsetZ; ROTATE bakes the turn into the points and resets the rotation
// metadata (rotation / rotationCenter — same rule as commitWrapperTransform
// clearRotation). Not copied (same as « Dupliquer »): glued openings,
// painted parts (meshPaints); POLYGON meshLines are dropped (absolute
// coords, they would sit on the source).
//
// One undo step: a single withUndoGroup around a single transaction.
//
// annotations: carried annotations, resolved in PIXELS (useAnnotationsV2).
// Returns { newAnnotationIds } (empty when nothing was written).

// Per-copy geometry recipe of a transform: the arguments of
// applyDeltaPosToAnnotation and the matching pixel affine.
function getCopyStep(transform, i) {
  if (transform.kind === "ROTATE") {
    const angleDeg = transform.angleDeg * i;
    return {
      deltaPos: { x: angleDeg, y: 0 },
      partType: "ROTATE",
      wrapperBbox: getPivotBbox(transform.pivotPx),
      affine: getPixelRotationAffine({ pivotPx: transform.pivotPx, angleDeg }),
      deltaPx: null,
      dz: 0,
    };
  }
  const delta = { x: transform.deltaPx.x * i, y: transform.deltaPx.y * i };
  return {
    deltaPos: delta,
    partType: null,
    wrapperBbox: undefined,
    affine: { a: 1, b: 0, c: delta.x, d: 0, e: 1, f: delta.y },
    deltaPx: delta,
    dz: (transform.deltaZ || 0) * i,
  };
}

function isValidTransform(transform) {
  if (transform?.kind === "MOVE") return Boolean(transform.deltaPx);
  if (transform?.kind === "ROTATE")
    return Boolean(transform.pivotPx) && Number.isFinite(transform.angleDeg);
  return false;
}

export default async function createTransformedAnnotationCopiesService({
  annotations,
  transform,
  count,
  imageSize,
  projectId,
  activeLayerId,
  dispatch,
}) {
  const result = { newAnnotationIds: [] };
  const copies = Math.floor(Number(count) || 0);
  if (
    !annotations?.length ||
    copies < 1 ||
    !isValidTransform(transform) ||
    !imageSize?.width ||
    !imageSize?.height
  ) {
    return result;
  }

  const sourceIds = annotations.map((a) => a.id);
  const storedRows = await db.annotations.bulkGet(sourceIds);
  const storedById = new Map();
  storedRows.forEach((row) => {
    if (row) storedById.set(row.id, row);
  });

  const allocateAutoLabel = createAutoNumberLabelAllocator();
  const { width, height } = imageSize;

  const newAnnotations = [];
  const newPoints = [];
  const sourceIdOfNew = []; // parallel to newAnnotations (mapping rels)

  for (let i = 1; i <= copies; i++) {
    const { deltaPos, partType, wrapperBbox, affine, deltaPx, dz } =
      getCopyStep(transform, i);
    // One map per copy: points shared between carried annotations stay
    // welded in the copy, never with the sources or another copy.
    const idMap = new Map();

    for (const resolved of annotations) {
      const stored = storedById.get(resolved.id);
      if (!stored) continue;
      const isFreeText = isFreeTextType(stored.type);
      if (isFreeText && !deltaPx) continue;

      const transformed = applyDeltaPosToAnnotation(
        resolved,
        deltaPos,
        partType,
        wrapperBbox
      );
      const { annotation: remapped, pointRecords } = duplicateAnnotationPoints(
        transformed,
        {
          imageSize,
          projectId,
          baseMapId: stored.baseMapId,
          listingId: stored.listingId,
          idMap,
        }
      );
      newPoints.push(...pointRecords);

      // Audit fields are re-stamped by the db hooks; meshLines are dropped.
      const base = { ...stored };
      delete base.createdAt;
      delete base.updatedAt;
      delete base.createdByUserIdMaster;
      delete base.meshLines;

      const copy = {
        ...base,
        id: nanoid(),
        ...(Array.isArray(remapped.points) ? { points: remapped.points } : {}),
        ...(Array.isArray(remapped.cuts) ? { cuts: remapped.cuts } : {}),
        ...(Array.isArray(remapped.innerPoints)
          ? { innerPoints: remapped.innerPoints }
          : {}),
        ...(Array.isArray(remapped.guideLines)
          ? { guideLines: remapped.guideLines }
          : {}),
        ...(Array.isArray(remapped.isoHeightLines)
          ? { isoHeightLines: remapped.isoHeightLines }
          : {}),
        ...(Array.isArray(remapped.profileLines)
          ? { profileLines: remapped.profileLines }
          : {}),
        ...(Array.isArray(remapped.layoutLines)
          ? { layoutLines: remapped.layoutLines }
          : {}),
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      };

      if (isFreeText) {
        // `transformed` already carries the translated pixel points: a zero
        // delta normalizes them back to the stored shape.
        const freeTextUpdate = getFreeTextMoveUpdates({
          annotations: [transformed],
          deltaPx: { x: 0, y: 0 },
          imageSize,
        }).get(transformed.id);
        if (!freeTextUpdate) continue;
        Object.assign(copy, freeTextUpdate);
      }

      if (deltaPx) {
        if (stored.rotationCenter) {
          copy.rotationCenter = {
            x: stored.rotationCenter.x + deltaPx.x / width,
            y: stored.rotationCenter.y + deltaPx.y / height,
          };
        }
      } else {
        // The turn is baked into the points: the single-centre rotation
        // model no longer describes the copy.
        delete copy.rotationCenter;
        if (stored.rotation) copy.rotation = 0;
      }

      if (Math.abs(dz) > 1e-9) {
        copy.offsetZ = roundOffsetZ((Number(stored.offsetZ) || 0) + dz);
      }

      if (stored.isMesh3d && stored.mesh3d?.vertices) {
        copy.mesh3d = applyAffineToMesh3d(stored.mesh3d, affine, imageSize);
        if (stored.mesh3dSource) {
          copy.mesh3dSource = applyAffineToMesh3dSource(
            stored.mesh3dSource,
            affine,
            imageSize
          );
          if (Math.abs(dz) > 1e-9 && copy.mesh3dSource?.fields) {
            copy.mesh3dSource = {
              ...copy.mesh3dSource,
              fields: {
                ...copy.mesh3dSource.fields,
                offsetZ: roundOffsetZ(
                  (Number(copy.mesh3dSource.fields.offsetZ) || 0) + dz
                ),
              },
            };
          }
        }
      }

      const autoLabel = await allocateAutoLabel(stored.listingId);
      if (autoLabel) copy.label = autoLabel;

      newAnnotations.push(copy);
      sourceIdOfNew.push(stored.id);
    }
  }

  if (!newAnnotations.length) return result;

  // Mapping-category rows of the sources, re-keyed per copy (qty sums work
  // at once — same as the paste service).
  const sourceMappingRows = await db.relAnnotationMappingCategory
    .where("annotationId")
    .anyOf([...storedById.keys()])
    .toArray();
  const rowsBySourceId = new Map();
  for (const row of sourceMappingRows) {
    const list = rowsBySourceId.get(row.annotationId) || [];
    list.push(row);
    rowsBySourceId.set(row.annotationId, list);
  }
  const newMappingRows = [];
  newAnnotations.forEach((copy, idx) => {
    for (const row of rowsBySourceId.get(sourceIdOfNew[idx]) ?? []) {
      newMappingRows.push({ ...row, id: nanoid(), annotationId: copy.id });
    }
  });

  await withUndoGroup(async () => {
    await db.transaction(
      "rw",
      [db.points, db.annotations, db.relAnnotationMappingCategory],
      async () => {
        if (newPoints.length) await db.points.bulkAdd(newPoints);
        await db.annotations.bulkAdd(newAnnotations);
        if (newMappingRows.length)
          await db.relAnnotationMappingCategory.bulkAdd(newMappingRows);
      }
    );
  });

  dispatch?.(triggerAnnotationsUpdate());
  result.newAnnotationIds = newAnnotations.map((a) => a.id);
  return result;
}
