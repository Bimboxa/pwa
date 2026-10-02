import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { nanoid } from "@reduxjs/toolkit";

import applyAffineToMesh3d from "Features/annotationMesh3d/utils/applyAffineToMesh3d";
import fitAffine2d from "Features/annotationMesh3d/utils/fitAffine2d";
import { applyAffineToMesh3dSource } from "Features/annotationMesh3d/utils/mesh3dSource";
import {
  attachMeshPaintPointsUpdatedAt,
  getLiveMeshPaintsByHostIds,
  isMeshPaintStaleForHost,
} from "Features/meshPaint/services/copyMeshPaintsService";
import { filterMeshPaintsWritableHere } from "Features/meshPaint/services/meshPaintWriteGuard";
import applyAffineToPaintGeometry from "Features/meshPaint/utils/applyAffineToPaintGeometry";

// A host's paints follow its transform only when the fitted pixel affine
// reproduces every moved point (wrapper move / rotate / resize); a looser
// fit means the host was deformed, and the re-sync re-fits its paints.
const AFFINE_FIT_TOL_PX = 0.5;

const EMPTY_RESULT = { movedMeshPaintIds: [], refreshedMeshPaintIds: [] };

/**
 * Commit a wrapper transform (move/resize/rotate) to the database.
 * Handles shared point logic:
 *   - Points only referenced by selected annotations → update directly
 *   - Points shared with non-selected annotations → duplicate (create new point)
 *   - Points shared within the selection → keep shared (one update or one duplicate)
 *
 * isMesh3d annotations: their points are only the plan projection of the
 * stored mesh (annotation.mesh3d), so the mesh must follow. The affine map
 * the transform applied to the annotation's points is fitted from the point
 * updates and applied to the mesh, in the same transaction. This is the one
 * place every wrapper transform goes through — 2D move / resize / rotate and
 * the 3D move / rotate tools (commitAnnotationsTransformFrom3d).
 *
 * Painted mesh parts (« Pinceau » 3D, db.meshPaints) of every transformed
 * host follow it the same way: the host's pixel affine (the mesh one for an
 * isMesh3d host, else fitted on ALL its points — skipped when only some of
 * them move, i.e. a deformation the re-sync handles) is applied to the paint
 * geometry, plus `paintDeltaZ`. All the writes are ONE undo step.
 *
 * @param {Object} params
 * @param {string[]} params.selectedAnnotationIds - IDs of annotations in the wrapper
 * @param {Array} params.allAnnotations - All annotations currently loaded (with resolved points in pixel coords)
 * @param {Map<string, {x: number, y: number}>} params.pointUpdates - pointId → new position in PIXEL coords
 * @param {{ width: number, height: number }} params.imageSize
 * @param {number|null} params.rotationDelta - Rotation delta for ROTATE (degrees), null otherwise
 * @param {{ x: number, y: number }|null} params.moveDelta - Pixel delta for MOVE (to translate rotationCenter), null otherwise
 * @param {boolean} [params.isResize] - True when the transform is a RESIZE (clears rotation metadata)
 * @param {boolean} [params.clearRotation] - True when the transform invalidates the
 *   single-center rotation model (e.g. rotation around an arbitrary pivot from the
 *   3D tool) — same semantics as isResize: rotation metadata is reset.
 * @param {number} [params.paintDeltaZ] - Vertical shift (m) of the painted mesh
 *   parts of the transformed hosts — the 3D move's offsetZ delta, which the
 *   caller writes on the annotations itself.
 * @returns {Promise<{movedMeshPaintIds: string[], refreshedMeshPaintIds: string[]}>}
 *   painted parts moved with their host; `refreshed` = those whose
 *   sync.syncedAt was bumped (they were not « à vérifier » before).
 */
export default async function commitWrapperTransform(params) {
  return withUndoGroup(() => commitWrapperTransformWrites(params));
}

async function commitWrapperTransformWrites({
  selectedAnnotationIds,
  allAnnotations,
  pointUpdates,
  imageSize,
  rotationDelta,
  wrapperBbox,
  moveDelta,
  isResize,
  clearRotation,
  paintDeltaZ = 0,
}) {
  if (!selectedAnnotationIds?.length || !allAnnotations?.length || !imageSize)
    return EMPTY_RESULT;

  const selectedSet = new Set(selectedAnnotationIds);

  // 1. Build reference map: pointId → Set of annotationIds that reference it
  const pointReferences = new Map();

  for (const ann of allAnnotations) {
    const addRef = (pointId) => {
      if (!pointReferences.has(pointId)) pointReferences.set(pointId, new Set());
      pointReferences.get(pointId).add(ann.id);
    };
    for (const pt of ann.points ?? []) addRef(pt.id);
    for (const cut of ann.cuts ?? []) {
      for (const pt of cut.points ?? []) addRef(pt.id);
    }
    for (const pt of ann.innerPoints ?? []) addRef(pt.id);
    // guideLines / isoHeightLines / profileLines refs key on `pointId` (see
    // resolveGuideLine)
    for (const line of [
      ...(ann.guideLines ?? []),
      ...(ann.isoHeightLines ?? []),
      ...(ann.profileLines ?? []),
    ]) {
      for (const pt of line?.points ?? []) {
        const pointId = pt.pointId ?? pt.id;
        if (pointId != null) addRef(pointId);
      }
    }
  }

  // 2. Classify points: exclusive vs shared_external
  const exclusivePoints = new Set(); // can update directly
  const sharedExternalPoints = new Set(); // need to duplicate

  for (const [pointId] of pointUpdates) {
    const refs = pointReferences.get(pointId);
    if (!refs) {
      exclusivePoints.add(pointId);
      continue;
    }

    const isExclusive = [...refs].every((annId) => selectedSet.has(annId));
    if (isExclusive) {
      exclusivePoints.add(pointId);
    } else {
      sharedExternalPoints.add(pointId);
    }
  }

  // 3. Prepare shared external point duplicates (need original data before transaction)
  const oldToNewIdMap = new Map(); // oldPointId → newPointId
  const newPointsToAdd = [];

  for (const oldPointId of sharedExternalPoints) {
    const newPos = pointUpdates.get(oldPointId);
    if (!newPos) continue;

    const newPointId = nanoid();
    oldToNewIdMap.set(oldPointId, newPointId);

    const originalPoint = await db.points.get(oldPointId);
    if (originalPoint) {
      newPointsToAdd.push({
        ...originalPoint,
        id: newPointId,
        x: newPos.x / imageSize.width,
        y: newPos.y / imageSize.height,
      });
    }
  }

  // 3b. isMesh3d annotations: the affine map their projection went through
  //     (the mesh follows it in 4c').
  const meshAffineById = new Map();
  for (const annId of selectedAnnotationIds) {
    const ann = allAnnotations.find((a) => a.id === annId);
    if (!ann?.isMesh3d || !ann.mesh3d?.vertices?.length) continue;
    const pairs = [];
    const collect = (pt) => {
      const to = pointUpdates.get(pt?.id);
      if (to && pt.x != null && pt.y != null) {
        pairs.push({ from: { x: pt.x, y: pt.y }, to });
      }
    };
    for (const pt of ann.points ?? []) collect(pt);
    for (const cut of ann.cuts ?? []) {
      for (const pt of cut.points ?? []) collect(pt);
    }
    const affine = fitAffine2d(pairs);
    if (affine) meshAffineById.set(annId, affine);
  }

  // 3c. Painted mesh parts of the transformed hosts.
  const paintMoves = await planMeshPaintMoves({
    selectedAnnotationIds,
    allAnnotations,
    pointUpdates,
    imageSize,
    meshAffineById,
    paintDeltaZ,
  });

  // 4. Execute ALL updates in a single transaction so useLiveQuery
  //    never observes an intermediate state (e.g. rotated points
  //    without the updated rotation/rotationCenter on the annotation).
  const tables = [db.points, db.annotations, db.meshPaints];
  await db.transaction("rw", tables, async () => {
    const ops = [];

    // 4a. Exclusive points: direct update
    for (const pointId of exclusivePoints) {
      const newPos = pointUpdates.get(pointId);
      if (!newPos) continue;
      ops.push(
        db.points.update(pointId, {
          x: newPos.x / imageSize.width,
          y: newPos.y / imageSize.height,
        })
      );
    }

    // 4b. Add duplicated points
    if (newPointsToAdd.length > 0) {
      ops.push(db.points.bulkAdd(newPointsToAdd));
    }

    // 4c. Update annotation references for duplicated points
    if (oldToNewIdMap.size > 0) {
      const replacePointId = (pt) => {
        const newId = oldToNewIdMap.get(pt.id);
        return newId ? { ...pt, id: newId } : pt;
      };
      // guideLines / isoHeightLines refs key on `pointId` (resolved refs also
      // mirror it on `id`, keep both in sync)
      const replaceLineRef = (ref) => {
        const newId = oldToNewIdMap.get(ref.pointId ?? ref.id);
        if (!newId) return ref;
        const next = { ...ref, pointId: newId };
        if (ref.id != null) next.id = newId;
        return next;
      };
      const replaceLinesRefs = (lines) =>
        lines.map((line) => ({
          ...line,
          points: line.points?.map(replaceLineRef),
        }));
      const linesChanged = (newLines, oldLines) =>
        newLines.some((line, li) =>
          line.points?.some(
            (ref, ri) =>
              (ref.pointId ?? ref.id) !==
              (oldLines[li].points?.[ri]?.pointId ??
                oldLines[li].points?.[ri]?.id)
          )
        );

      for (const annId of selectedAnnotationIds) {
        const ann = allAnnotations.find((a) => a.id === annId);
        if (!ann) continue;

        const updates = {};
        let hasChanges = false;

        if (ann.points) {
          const newPoints = ann.points.map(replacePointId);
          if (newPoints.some((pt, i) => pt.id !== ann.points[i].id)) {
            updates.points = newPoints;
            hasChanges = true;
          }
        }

        if (ann.cuts) {
          const newCuts = ann.cuts.map((cut) => ({
            ...cut,
            points: cut.points?.map(replacePointId),
          }));
          const cutsChanged = newCuts.some((cut, ci) =>
            cut.points?.some((pt, pi) => pt.id !== ann.cuts[ci].points?.[pi]?.id)
          );
          if (cutsChanged) {
            updates.cuts = newCuts;
            hasChanges = true;
          }
        }

        if (ann.innerPoints) {
          const newInnerPoints = ann.innerPoints.map(replacePointId);
          if (newInnerPoints.some((pt, i) => pt.id !== ann.innerPoints[i].id)) {
            updates.innerPoints = newInnerPoints;
            hasChanges = true;
          }
        }

        if (ann.guideLines) {
          const newGuideLines = replaceLinesRefs(ann.guideLines);
          if (linesChanged(newGuideLines, ann.guideLines)) {
            updates.guideLines = newGuideLines;
            hasChanges = true;
          }
        }

        if (ann.isoHeightLines) {
          const newIsoHeightLines = replaceLinesRefs(ann.isoHeightLines);
          if (linesChanged(newIsoHeightLines, ann.isoHeightLines)) {
            updates.isoHeightLines = newIsoHeightLines;
            hasChanges = true;
          }
        }

        if (ann.profileLines) {
          const newProfileLines = replaceLinesRefs(ann.profileLines);
          if (linesChanged(newProfileLines, ann.profileLines)) {
            updates.profileLines = newProfileLines;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          ops.push(db.annotations.update(annId, updates));
        }
      }
    }

    // 4c'. isMesh3d annotations: carry the mesh along with its projection.
    for (const [annId, affine] of meshAffineById) {
      const ann = allAnnotations.find((a) => a.id === annId);
      ops.push(
        db.annotations.update(annId, {
          mesh3d: applyAffineToMesh3d(ann.mesh3d, affine, imageSize),
          // The snapshot of the original geometry follows too: a reset
          // restores it where the mesh now stands.
          ...(ann.mesh3dSource
            ? {
                mesh3dSource: applyAffineToMesh3dSource(
                  ann.mesh3dSource,
                  affine,
                  imageSize
                ),
              }
            : {}),
        })
      );
    }

    // 4d. Handle rotation
    if (rotationDelta != null && rotationDelta !== 0) {
      for (const annId of selectedAnnotationIds) {
        const ann = allAnnotations.find((a) => a.id === annId);
        if (!ann) continue;
        const currentRotation = ann.rotation ?? 0;
        let newRotation = (currentRotation + rotationDelta) % 360;
        if (newRotation < 0) newRotation += 360;

        const updates = { rotation: newRotation };

        // Store rotation center (normalized) on first rotation
        if (!ann.rotationCenter && wrapperBbox) {
          updates.rotationCenter = {
            x: (wrapperBbox.x + wrapperBbox.width / 2) / imageSize.width,
            y: (wrapperBbox.y + wrapperBbox.height / 2) / imageSize.height,
          };
        }

        ops.push(db.annotations.update(annId, updates));
      }
    }

    // 4e. Translate rotationCenter on MOVE
    if (moveDelta) {
      for (const annId of selectedAnnotationIds) {
        const ann = allAnnotations.find((a) => a.id === annId);
        if (!ann?.rotationCenter) continue;
        ops.push(
          db.annotations.update(annId, {
            rotationCenter: {
              x: (ann.rotationCenter.x + moveDelta.x) / imageSize.width,
              y: (ann.rotationCenter.y + moveDelta.y) / imageSize.height,
            },
          })
        );
      }
    }

    // 4f. Clear rotation metadata on RESIZE (or any transform that bakes the
    // rotation into the points, e.g. the 3D pivot rotation).
    // Resize scales points in the axis-aligned space, which "bakes in" the
    // prior rotation. The old rotation/rotationCenter no longer describe the
    // geometry, so we reset them so the next rotation starts fresh.
    if (isResize || clearRotation) {
      for (const annId of selectedAnnotationIds) {
        const ann = allAnnotations.find((a) => a.id === annId);
        if (!ann?.rotation && !ann?.rotationCenter) continue;
        ops.push(
          db.annotations.update(annId, {
            rotation: 0,
            rotationCenter: null,
          })
        );
      }
    }

    await Promise.all(ops);

    // 4g. Painted mesh parts follow their host. Written last: a fresh
    // syncedAt must not precede the host's audit stamp of this transaction
    // (« à vérifier » = host.updatedAt > sync.syncedAt).
    if (paintMoves.length > 0) {
      const syncedAt = new Date().toISOString();
      await Promise.all(
        paintMoves.map(({ row, geometry, refreshSyncedAt }) =>
          db.meshPaints.update(row.id, {
            geometry,
            ...(refreshSyncedAt
              ? { sync: { ...(row.sync ?? {}), syncedAt } }
              : {}),
          })
        )
      );
    }
  });

  return {
    movedMeshPaintIds: paintMoves.map((m) => m.row.id),
    refreshedMeshPaintIds: paintMoves
      .filter((m) => m.refreshSyncedAt)
      .map((m) => m.row.id),
  };
}

// Point refs a wrapper transform carries (same sets as
// applyWrapperTransformToPoints), as {id, x, y} in pixels.
function getTransformedPointRefs(ann) {
  const refs = [];
  const add = (id, pt) => refs.push({ id, x: pt?.x, y: pt?.y });
  for (const pt of ann.points ?? []) add(pt?.id, pt);
  for (const cut of ann.cuts ?? []) {
    for (const pt of cut.points ?? []) add(pt?.id, pt);
  }
  for (const pt of ann.innerPoints ?? []) add(pt?.id, pt);
  for (const line of [
    ...(ann.guideLines ?? []),
    ...(ann.isoHeightLines ?? []),
    ...(ann.profileLines ?? []),
  ]) {
    for (const pt of line?.points ?? []) add(pt?.pointId ?? pt?.id, pt);
  }
  return refs.filter((ref) => ref.id != null);
}

// Pixel affine of an annotation transformed AS A WHOLE: every point it
// references is carried by the transform and one affine map reproduces them
// all. null otherwise (some points left behind = the host is deformed).
function fitWholeAnnotationAffine(ann, pointUpdates) {
  const pairs = [];
  for (const ref of getTransformedPointRefs(ann)) {
    const to = pointUpdates.get(ref.id);
    if (!to || ref.x == null || ref.y == null) return null;
    pairs.push({ from: { x: ref.x, y: ref.y }, to });
  }
  const affine = fitAffine2d(pairs);
  if (!affine) return null;
  const { a, b, c, d, e, f } = affine;
  for (const { from, to } of pairs) {
    const x = a * from.x + b * from.y + c;
    const y = d * from.x + e * from.y + f;
    if (Math.hypot(x - to.x, y - to.y) > AFFINE_FIT_TOL_PX) return null;
  }
  return affine;
}

// New geometry of every live paint hosted by a transformed annotation.
// refreshSyncedAt: the paint moved exactly with its host, so it stays in
// sync — unless it was already « à vérifier » (host changed elsewhere).
async function planMeshPaintMoves({
  selectedAnnotationIds,
  allAnnotations,
  pointUpdates,
  imageSize,
  meshAffineById,
  paintDeltaZ,
}) {
  // Paints of a scope linking this one's listings are left to that scope
  // (its re-sync re-attaches them): writing them here would abort the move.
  const rows = filterMeshPaintsWritableHere(
    await getLiveMeshPaintsByHostIds(selectedAnnotationIds)
  );
  if (rows.length === 0) return [];

  const hostIds = [...new Set(rows.map((r) => r.hostAnnotationId))];
  const baseMapIds = [...new Set(rows.map((r) => r.baseMapId).filter(Boolean))];
  const [hostRows, baseMaps] = await Promise.all([
    db.annotations.bulkGet(hostIds).then(attachMeshPaintPointsUpdatedAt),
    db.baseMaps.bulkGet(baseMapIds),
  ]);
  const hostRowById = new Map(hostRows.filter(Boolean).map((h) => [h.id, h]));
  const meterByPxByBaseMapId = new Map(
    baseMaps
      .filter(Boolean)
      .map((bm) => [
        bm.id,
        Number(bm.meterByPx) > 0 ? Number(bm.meterByPx) : 0.01,
      ])
  );

  const dz = Number(paintDeltaZ) || 0;
  const affineByHostId = new Map();
  for (const hostId of hostIds) {
    const ann = allAnnotations.find((a) => a.id === hostId);
    if (!ann) continue;
    const affine =
      meshAffineById.get(hostId) ?? fitWholeAnnotationAffine(ann, pointUpdates);
    if (affine)
      affineByHostId.set(hostId, { affine, baseMapId: ann.baseMapId });
  }

  const moves = [];
  for (const row of rows) {
    const host = affineByHostId.get(row.hostAnnotationId);
    if (!host) continue;
    // The pixel affine lives in the host's base map frame.
    if (host.baseMapId && row.baseMapId !== host.baseMapId) continue;
    const metrics = {
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      meterByPx: meterByPxByBaseMapId.get(row.baseMapId) ?? 0.01,
    };
    const geometry = applyAffineToPaintGeometry({
      partType: row.partType,
      geometry: row.geometry,
      affine: host.affine,
      imageSize,
      dz,
      metrics,
    });
    if (!geometry) continue;
    moves.push({
      row,
      geometry,
      refreshSyncedAt: !isMeshPaintStaleForHost(
        row,
        hostRowById.get(row.hostAnnotationId)
      ),
    });
  }
  return moves;
}
