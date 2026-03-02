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
 */
export default async function commitWrapperTransform({
  selectedAnnotationIds,
  allAnnotations,
  pointUpdates,
  imageSize,
  rotationDelta,
  wrapperBbox,
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

  // 3. Execute updates

  // 3a. Exclusive points: direct update
  const directUpdates = [];
  for (const pointId of exclusivePoints) {
    const newPos = pointUpdates.get(pointId);
    if (!newPos) continue;
    directUpdates.push(
      db.points.update(pointId, {
        x: newPos.x / imageSize.width,
        y: newPos.y / imageSize.height,
      })
    );
  }

  // 3b. Shared external points: duplicate
  // One new point per old point (shared within selection stays shared)
  const oldToNewIdMap = new Map(); // oldPointId → newPointId
  const newPointsToAdd = [];

  for (const oldPointId of sharedExternalPoints) {
    const newPos = pointUpdates.get(oldPointId);
    if (!newPos) continue;

    const newPointId = nanoid();
    oldToNewIdMap.set(oldPointId, newPointId);

    // Fetch original point to copy its properties
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

  // Add all new points
  if (newPointsToAdd.length > 0) {
    await db.points.bulkAdd(newPointsToAdd);
  }

  // 3c. Update annotation references for duplicated points
  const annotationUpdates = [];

  if (oldToNewIdMap.size > 0) {
    const replacePointId = (pt) => {
      const newId = oldToNewIdMap.get(pt.id);
      return newId ? { ...pt, id: newId } : pt;
    };

    for (const annId of selectedAnnotationIds) {
      const ann = allAnnotations.find((a) => a.id === annId);
      if (!ann) continue;

      const updates = {};
      let hasChanges = false;

      // Update main points
      if (ann.points) {
        const newPoints = ann.points.map(replacePointId);
        if (newPoints.some((pt, i) => pt.id !== ann.points[i].id)) {
          updates.points = newPoints;
          hasChanges = true;
        }
      }

      // Update cuts
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

      if (hasChanges) {
        annotationUpdates.push(db.annotations.update(annId, updates));
      }
    }
  }

  // 3d. Handle rotation
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

      annotationUpdates.push(db.annotations.update(annId, updates));
    }
  }

  // Execute all operations
  await Promise.all([...directUpdates, ...annotationUpdates]);
}
