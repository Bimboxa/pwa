import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import { setActiveLayerId, triggerLayersUpdate } from "../layersSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
import {
  remapPointIds,
  remapAnnotationIds,
} from "Features/annotations/utils/remapAnnotationRefs";

export default function useCreateLayer() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const createLayer = async ({ baseMapId, name, annotationIdsToDuplicate }) => {
    // compute orderIndex after the last existing layer
    const existing = await db.layers
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    const sorted = existing
      .filter((r) => !r.deletedAt && r.orderIndex != null)
      .map((r) => r.orderIndex)
      .sort();
    const lastIndex = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const orderIndex = generateKeyBetween(lastIndex, null);

    const layer = {
      id: nanoid(),
      baseMapId,
      projectId,
      scopeId,
      name,
      orderIndex,
    };

    await db.layers.add(layer);

    // duplicate annotations if requested
    if (annotationIdsToDuplicate?.length > 0) {
      await duplicateAnnotations(annotationIdsToDuplicate, layer.id);
      dispatch(triggerAnnotationsUpdate());
    }

    dispatch(triggerLayersUpdate());
    dispatch(setActiveLayerId(layer.id));

    return layer;
  };

  return createLayer;
}

async function duplicateAnnotations(annotationIds, newLayerId) {
  const sourceAnnotations = (
    await db.annotations.bulkGet(annotationIds)
  ).filter(Boolean);
  if (sourceAnnotations.length === 0) return;

  const sourceIds = sourceAnnotations.map((a) => a.id);

  // old ID -> new ID map for annotations, built upfront so intra-batch
  // references (cuts[].cutHostId, proxy.proxySourceAnnotationId, rels)
  // can be remapped to the copies
  const annotationIdMap = {};
  for (const id of sourceIds) {
    annotationIdMap[id] = nanoid();
  }

  // collect all referenced point IDs (points, innerPoints, cuts, point,
  // guideLines) and fetch source points + rels before the write transaction
  const pointIds = collectReferencedPointIds(sourceAnnotations);
  const [sourcePoints, meshRels, subtractionRels, openingRels] =
    await Promise.all([
    pointIds.size > 0
      ? db.points.bulkGet([...pointIds]).then((pts) => pts.filter(Boolean))
      : [],
    db.relAnnotationMeshCells
      .where("parentAnnotationId")
      .anyOf(sourceIds)
      .toArray(),
    db.relAnnotationSubtractions
      .where("sourceAnnotationId")
      .anyOf(sourceIds)
      .toArray(),
    db.relAnnotationOpenings
      .where("hostAnnotationId")
      .anyOf(sourceIds)
      .toArray(),
  ]);

  // duplicate points, building old ID -> new ID map
  const pointIdMap = {};
  const newPoints = sourcePoints.map((pt) => {
    const newId = nanoid();
    pointIdMap[pt.id] = newId;
    return {
      ...pt,
      id: newId,
      createdAt: undefined,
      updatedAt: undefined,
      createdByUserIdMaster: undefined,
    };
  });

  // duplicate annotations with new IDs and remapped references
  const newAnnotations = sourceAnnotations.map((ann) => {
    const newAnn = {
      ...ann,
      id: annotationIdMap[ann.id],
      layerId: newLayerId,
      createdAt: undefined,
      updatedAt: undefined,
      createdByUserIdMaster: undefined,
    };
    remapPointIds(newAnn, pointIdMap);
    remapAnnotationIds(newAnn, annotationIdMap);
    return newAnn;
  });

  // duplicate rels whose both ends are in the duplicated batch
  const newMeshRels = meshRels
    .filter(
      (r) =>
        !r.deletedAt &&
        annotationIdMap[r.parentAnnotationId] &&
        annotationIdMap[r.meshCellAnnotationId]
    )
    .map((r) => ({
      ...r,
      id: nanoid(),
      parentAnnotationId: annotationIdMap[r.parentAnnotationId],
      meshCellAnnotationId: annotationIdMap[r.meshCellAnnotationId],
      createdAt: undefined,
      updatedAt: undefined,
      createdByUserIdMaster: undefined,
    }));
  const newSubtractionRels = subtractionRels
    .filter(
      (r) =>
        !r.deletedAt &&
        annotationIdMap[r.sourceAnnotationId] &&
        annotationIdMap[r.targetAnnotationId]
    )
    .map((r) => ({
      ...r,
      id: nanoid(),
      sourceAnnotationId: annotationIdMap[r.sourceAnnotationId],
      targetAnnotationId: annotationIdMap[r.targetAnnotationId],
      createdAt: undefined,
      updatedAt: undefined,
      createdByUserIdMaster: undefined,
    }));
  const newOpeningRels = openingRels
    .filter(
      (r) =>
        !r.deletedAt &&
        annotationIdMap[r.hostAnnotationId] &&
        annotationIdMap[r.openingAnnotationId]
    )
    .map((r) => ({
      ...r,
      id: nanoid(),
      hostAnnotationId: annotationIdMap[r.hostAnnotationId],
      openingAnnotationId: annotationIdMap[r.openingAnnotationId],
      hostSegmentStartPointId:
        pointIdMap[r.hostSegmentStartPointId] ?? r.hostSegmentStartPointId,
      hostSegmentEndPointId:
        pointIdMap[r.hostSegmentEndPointId] ?? r.hostSegmentEndPointId,
      hostArcControlPointId: r.hostArcControlPointId
        ? (pointIdMap[r.hostArcControlPointId] ?? r.hostArcControlPointId)
        : null,
      carve:
        r.carve && Array.isArray(r.carve.notchPointIds)
          ? {
              ...r.carve,
              notchPointIds: r.carve.notchPointIds.map(
                (pid) => pointIdMap[pid] ?? pid
              ),
            }
          : r.carve,
      createdAt: undefined,
      updatedAt: undefined,
      createdByUserIdMaster: undefined,
    }));

  // single transaction, single triggerAnnotationsUpdate dispatched by caller
  await db.transaction(
    "rw",
    [
      db.points,
      db.annotations,
      db.relAnnotationMeshCells,
      db.relAnnotationSubtractions,
      db.relAnnotationOpenings,
    ],
    async () => {
      if (newPoints.length > 0) await db.points.bulkAdd(newPoints);
      await db.annotations.bulkAdd(newAnnotations);
      if (newMeshRels.length > 0)
        await db.relAnnotationMeshCells.bulkAdd(newMeshRels);
      if (newSubtractionRels.length > 0)
        await db.relAnnotationSubtractions.bulkAdd(newSubtractionRels);
      if (newOpeningRels.length > 0)
        await db.relAnnotationOpenings.bulkAdd(newOpeningRels);
    }
  );
}
