import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

/**
 * Commit a wrapper transform (move/resize/rotate) to the database.
 * Handles shared point logic:
 *   - Points only referenced by selected annotations → update directly
 *   - Points shared with non-selected annotations → duplicate (create new point)
 *   - Points shared within the selection → keep shared (one update or one duplicate)
 *
 * @param {Object} params
 * @param {string[]} params.selectedAnnotationIds - IDs of annotations in the wrapper
 * @param {Array} params.allAnnotations - All annotations currently loaded (with resolved points in pixel coords)
 * @param {Map<string, {x: number, y: number}>} params.pointUpdates - pointId → new position in PIXEL coords
 * @param {{ width: number, height: number }} params.imageSize
 * @param {number|null} params.rotationDelta - Rotation delta for ROTATE (degrees), null otherwise
 * @param {{ x: number, y: number }|null} params.moveDelta - Pixel delta for MOVE (to translate rotationCenter), null otherwise
 * @param {boolean} [params.isResize] - True when the transform is a RESIZE (clears rotation metadata)
 */
export default async function commitWrapperTransform({
  selectedAnnotationIds,
  allAnnotations,
  pointUpdates,
  imageSize,
  rotationDelta,
  wrapperBbox,
  moveDelta,
  isResize,
}) {
  if (!selectedAnnotationIds?.length || !allAnnotations?.length || !imageSize) return;

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
    // guideLines / isoHeightLines refs key on `pointId` (see resolveGuideLine)
    for (const line of [...(ann.guideLines ?? []), ...(ann.isoHeightLines ?? [])]) {
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

  // 4. Execute ALL updates in a single transaction so useLiveQuery
  //    never observes an intermediate state (e.g. rotated points
  //    without the updated rotation/rotationCenter on the annotation).
  await db.transaction("rw", db.points, db.annotations, async () => {
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

        if (hasChanges) {
          ops.push(db.annotations.update(annId, updates));
        }
      }
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

    // 4f. Clear rotation metadata on RESIZE
    // Resize scales points in the axis-aligned space, which "bakes in" the
    // prior rotation. The old rotation/rotationCenter no longer describe the
    // geometry, so we reset them so the next rotation starts fresh.
    if (isResize) {
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
  });
}
