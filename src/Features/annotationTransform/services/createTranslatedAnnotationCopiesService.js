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

// « Copie multiple » of the « Déplacer » tools (2D and 3D): N translated
// copies of the carried annotations, copy i at i × `deltaPx`, the originals
// untouched. Shared by the 2D commit (pixel delta from the click) and the 3D
// one (local metres mapped to pixels, vertical component as `deltaZ`).
//
// Each copy is built from the STORED row of its source (never from the
// hydrated object of useAnnotationsV2 — template-merged props, quantities,
// `_xxx` runtime fields…), onto which only the geometry is grafted: the
// resolved pixel points are translated (applyDeltaPosToAnnotation) and
// re-minted as fresh db.points (duplicateAnnotationPoints, one id map per
// copy so a vertex shared by two carried walls stays shared by their copies).
//
// Also carried: rotationCenter, offsetZ (+ i × deltaZ), the isMesh3d mesh
// and its source snapshot (translation affine), the mapping-category rels,
// the active layer, the listing's auto-number labels. Not copied (same as
// « Dupliquer »): glued openings, painted parts (meshPaints); POLYGON
// meshLines are dropped (absolute coords, they would sit on the source).
//
// One undo step: a single withUndoGroup around a single transaction.
//
// annotations: carried annotations, resolved in PIXELS (useAnnotationsV2).
// Returns { newAnnotationIds } (empty when nothing was written).
export default async function createTranslatedAnnotationCopiesService({
  annotations,
  deltaPx,
  deltaZ = 0,
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
    !deltaPx ||
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
    const delta = { x: deltaPx.x * i, y: deltaPx.y * i };
    const dz = deltaZ * i;
    const affine = { a: 1, b: 0, c: delta.x, d: 0, e: 1, f: delta.y };
    // One map per copy: points shared between carried annotations stay
    // welded in the copy, never with the sources or another copy.
    const idMap = new Map();

    for (const resolved of annotations) {
      const stored = storedById.get(resolved.id);
      if (!stored) continue;

      const translated = applyDeltaPosToAnnotation(resolved, delta, null);
      const { annotation: remapped, pointRecords } = duplicateAnnotationPoints(
        translated,
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
        points: remapped.points,
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
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      };

      if (stored.rotationCenter) {
        copy.rotationCenter = {
          x: stored.rotationCenter.x + delta.x / width,
          y: stored.rotationCenter.y + delta.y / height,
        };
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
