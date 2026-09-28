import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";
import duplicateAndMovePoint from "Features/mapEditor/services/duplicateAndMovePoint";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";
import computeOpeningAnchorRemap from "Features/annotations/utils/computeOpeningAnchorRemap";
import softDeleteOrphanPoints from "Features/annotations/services/softDeleteOrphanPoints";
import {
  SEGMENT_FLAG_FIELDS,
  getRingSegmentFlagPointIds,
} from "Features/annotations/utils/segmentFlags";

import db from "App/db/db";

// Persist the merges computed by computeJoinAnnotationEnds ("Joindre" with
// « Fusionner si possible »). Each merge chains two walls of the same
// template / width into ONE polyline:
//
//   - the survivor's end vertex is moved onto the junction (shared vertex →
//     forked first via duplicateAndMovePoint, like applyJoinAnnotationEndsService);
//   - the absorbed wall's refs (minus its own end vertex, reversed when needed)
//     are appended / prepended to the survivor's refs — db.points rows are
//     REUSED, never copied (see docs/annotations/POINTS_STORAGE.md);
//   - the absorbed wall's segment flags are remapped onto the merged chain,
//     its glued openings are re-hosted on the survivor, its other rels are
//     soft-deleted (same cascade as useDeleteAnnotations) and the row itself
//     is soft-deleted.
//
// `merges` is [{ keepId, keepEndPointId, dropId, dropEndPointId, junction,
// attachAtStart, reverseDropped }] with `junction` in PIXELS; `annotations`
// are the RESOLVED annotations of the base map.

const toRef = ({ x, y, ...ref }) => ref; // eslint-disable-line no-unused-vars

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export default async function applyJoinAnnotationMergesService({
  merges,
  annotations,
  meterByPx,
  dispatch,
}) {
  if (!merges?.length) return { ok: true, mergedCount: 0 };

  const resolvedById = new Map((annotations || []).map((a) => [a.id, a]));

  // pointId → number of annotations referencing it (contour + cuts).
  const refCount = new Map();
  for (const a of annotations || []) {
    const ids = new Set();
    a.points?.forEach((p) => p?.id && ids.add(p.id));
    a.cuts?.forEach((cut) =>
      cut?.points?.forEach((p) => p?.id && ids.add(p.id))
    );
    ids.forEach((id) => refCount.set(id, (refCount.get(id) || 0) + 1));
  }

  let imageSize = null;
  const getImageSize = async (baseMapId) => {
    if (imageSize) return imageSize;
    const record = await db.baseMaps.get(baseMapId);
    const versions = await db.baseMapVersions
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    imageSize = getBaseMapImageSizeFromRecord(record, versions);
    return imageSize;
  };

  let mergedCount = 0;
  const survivorIds = new Set();
  let projectId = null;
  let baseMapId = null;

  for (const merge of merges) {
    try {
      const done = await applyOneMerge({
        merge,
        resolvedById,
        refCount,
        annotations,
        getImageSize,
      });
      if (!done) continue;
      mergedCount += 1;
      survivorIds.add(merge.keepId);
      projectId = projectId || done.projectId;
      baseMapId = baseMapId || done.baseMapId;
      // Best-effort: the absorbed end vertex is now unreferenced (unless
      // another annotation shares it).
      try {
        await softDeleteOrphanPoints({
          baseMapIds: [done.baseMapId],
          candidatePointIds: new Set([merge.dropEndPointId]),
        });
      } catch (e) {
        console.error("[joinAnnotations] orphan point cleanup failed", e);
      }
    } catch (e) {
      console.error("[joinAnnotations] merge failed", merge, e);
    }
  }

  if (mergedCount === 0) return { ok: true, mergedCount: 0 };

  dispatch?.(triggerAnnotationsUpdate());

  // Openings re-hosted on the survivors follow the new contour.
  if (projectId && Number.isFinite(meterByPx) && meterByPx > 0) {
    try {
      await reflowOpeningsForHost({
        hostIds: [...survivorIds],
        projectId,
        imageSize,
        meterByPx,
      });
    } catch (e) {
      console.error("[openings] reflow failed", e);
    }
  }

  return { ok: true, mergedCount };
}

// One merge. Returns { projectId, baseMapId } when persisted, null when
// skipped (missing / deleted rows, no image size...).
async function applyOneMerge({
  merge,
  resolvedById,
  refCount,
  annotations,
  getImageSize,
}) {
  const { keepId, dropId, dropEndPointId, junction, attachAtStart } = merge;
  let { keepEndPointId } = merge;
  const { reverseDropped } = merge;

  const keepResolved = resolvedById.get(keepId);
  const dropResolved = resolvedById.get(dropId);
  if (!keepResolved?.baseMapId || !dropResolved) return null;

  const [keepRow, dropRow] = await db.annotations.bulkGet([keepId, dropId]);
  if (!keepRow || keepRow.deletedAt || !dropRow || dropRow.deletedAt)
    return null;

  const size = await getImageSize(keepResolved.baseMapId);
  if (!size?.width || !size?.height) return null;

  // 1. Survivor end vertex → junction.
  if ((refCount.get(keepEndPointId) || 0) > 1) {
    const { newPointId } = await duplicateAndMovePoint({
      originalPointId: keepEndPointId,
      annotationId: keepId,
      newPos: { x: junction.x, y: junction.y },
      imageSize: size,
      annotations,
    });
    keepEndPointId = newPointId;
  } else {
    await db.points.update(keepEndPointId, {
      x: junction.x / size.width,
      y: junction.y / size.height,
    });
  }
  // duplicateAndMovePoint rewrote the survivor's refs — reload the row so the
  // flags / refs below see the forked id.
  const keepRaw = await db.annotations.get(keepId);
  if (!keepRaw) return null;

  // 2. Merged refs (resolved order, orphans already filtered; no inline x/y).
  const keepRefs = (keepResolved.points || [])
    .filter((p) => p?.id)
    .map(toRef)
    .map((p) =>
      p.id === merge.keepEndPointId ? { ...p, id: keepEndPointId } : p
    );
  let dropRefs = (dropResolved.points || [])
    .filter((p) => p?.id && p.id !== dropEndPointId)
    .map(toRef);
  if (reverseDropped) dropRefs = [...dropRefs].reverse();
  const chained = attachAtStart
    ? [...dropRefs, ...keepRefs]
    : [...keepRefs, ...dropRefs];
  const points = chained.filter(
    (p, k) => k === 0 || p.id !== chained[k - 1].id
  );

  // 3. Segment flags — survivor ids stay valid; absorbed ids are remapped by
  // unordered vertex pair onto the merged chain (the absorbed end vertex is
  // now the survivor's end vertex).
  const startIdByPair = new Map();
  for (let k = 0; k < points.length - 1; k++) {
    startIdByPair.set(pairKey(points[k].id, points[k + 1].id), points[k].id);
  }
  const substitute = (id) => (id === dropEndPointId ? keepEndPointId : id);
  const dropRawIds = (dropRow.points || []).map((p) => p?.id).filter(Boolean);
  const dropSegmentByStartId = new Map();
  for (let k = 0; k < dropRawIds.length - 1; k++) {
    dropSegmentByStartId.set(dropRawIds[k], [dropRawIds[k], dropRawIds[k + 1]]);
  }
  const flagChanges = {};
  for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
    const keepIds =
      getRingSegmentFlagPointIds(keepRaw, idxField, idField, keepRaw.points, {
        closed: false,
      }) || [];
    const dropIds =
      getRingSegmentFlagPointIds(dropRow, idxField, idField, dropRow.points, {
        closed: false,
      }) || [];
    const remappedDrop = dropIds
      .map((id) => {
        const seg = dropSegmentByStartId.get(id);
        if (!seg) return null;
        return (
          startIdByPair.get(pairKey(substitute(seg[0]), substitute(seg[1]))) ??
          null
        );
      })
      .filter(Boolean);
    const hasAny =
      keepRaw[idField] !== undefined ||
      keepRaw[idxField] !== undefined ||
      dropIds.length > 0;
    if (!hasAny) continue;
    flagChanges[idField] = [...new Set([...keepIds, ...remappedDrop])];
    if (keepRaw[idxField] !== undefined) flagChanges[idxField] = undefined;
  }

  // 4. Cuts.
  const cutChanges = {};
  if (dropRow.cuts?.length) {
    cutChanges.cuts = [...(keepRaw.cuts || []), ...dropRow.cuts];
  }

  // 5. Rotation metadata is baked in by the vertex move.
  const rotationChanges =
    keepRaw.rotation || keepRaw.rotationCenter
      ? { rotation: 0, rotationCenter: null }
      : {};

  // 6. Rels of the absorbed wall.
  const openingRels = (
    await db.relAnnotationOpenings
      .where("hostAnnotationId")
      .equals(dropId)
      .toArray()
  ).filter((r) => !r.deletedAt);
  const anchorMap = { [dropEndPointId]: keepEndPointId };

  const [
    openingRelsAsOpening,
    relSrc,
    relTgt,
    meshAsParent,
    meshAsCell,
    zoneRels,
    businessObjectRels,
    workPackageRels,
  ] = await Promise.all([
    db.relAnnotationOpenings
      .where("openingAnnotationId")
      .equals(dropId)
      .toArray(),
    db.relAnnotationSubtractions
      .where("sourceAnnotationId")
      .equals(dropId)
      .toArray(),
    db.relAnnotationSubtractions
      .where("targetAnnotationId")
      .equals(dropId)
      .toArray(),
    db.relAnnotationMeshCells
      .where("parentAnnotationId")
      .equals(dropId)
      .toArray(),
    db.relAnnotationMeshCells
      .where("meshCellAnnotationId")
      .equals(dropId)
      .toArray(),
    db.relsZoneAnnotation.where("annotationId").equals(dropId).toArray(),
    db.relsBusinessObjectAnnotation
      .where("annotationId")
      .equals(dropId)
      .toArray(),
    db.relsWorkPackageAnnotation.where("annotationId").equals(dropId).toArray(),
  ]);
  const liveIds = (rows) => [
    ...new Set(rows.filter((r) => !r.deletedAt).map((r) => r.id)),
  ];
  const openingRelIdsToDelete = liveIds(openingRelsAsOpening);
  const subtractionRelIds = liveIds([...relSrc, ...relTgt]);
  const meshRelIds = liveIds([...meshAsParent, ...meshAsCell]);
  const zoneRelIds = liveIds(zoneRels);
  const businessObjectRelIds = liveIds(businessObjectRels);
  const workPackageRelIds = liveIds(workPackageRels);

  // 7. Listing order.
  let listingUpdate = null;
  if (dropRow.listingId && !dropRow.isBaseMapAnnotation) {
    const listing = await db.listings.get(dropRow.listingId);
    if (listing?.sortedAnnotationIds?.includes(dropId)) {
      listingUpdate = {
        id: listing.id,
        sortedAnnotationIds: listing.sortedAnnotationIds.filter(
          (id) => id !== dropId
        ),
      };
    }
  }

  await db.transaction(
    "rw",
    [
      db.annotations,
      db.points,
      db.listings,
      db.relAnnotationOpenings,
      db.relAnnotationSubtractions,
      db.relAnnotationMeshCells,
      db.relsZoneAnnotation,
      db.relsBusinessObjectAnnotation,
      db.relsWorkPackageAnnotation,
    ],
    async () => {
      await db.annotations.update(keepId, {
        points,
        ...flagChanges,
        ...cutChanges,
        ...rotationChanges,
      });

      for (const rel of openingRels) {
        await db.relAnnotationOpenings.update(rel.id, {
          hostAnnotationId: keepId,
          ...(computeOpeningAnchorRemap(rel, anchorMap) || {}),
        });
      }
      if (openingRelIdsToDelete.length)
        await db.relAnnotationOpenings.bulkDelete(openingRelIdsToDelete);
      if (subtractionRelIds.length)
        await db.relAnnotationSubtractions.bulkDelete(subtractionRelIds);
      if (meshRelIds.length)
        await db.relAnnotationMeshCells.bulkDelete(meshRelIds);
      if (zoneRelIds.length) await db.relsZoneAnnotation.bulkDelete(zoneRelIds);
      if (businessObjectRelIds.length)
        await db.relsBusinessObjectAnnotation.bulkDelete(businessObjectRelIds);
      if (workPackageRelIds.length)
        await db.relsWorkPackageAnnotation.bulkDelete(workPackageRelIds);
      if (listingUpdate)
        await db.listings.update(listingUpdate.id, {
          sortedAnnotationIds: listingUpdate.sortedAnnotationIds,
        });

      await db.annotations.delete(dropId);
    }
  );

  return {
    projectId: keepResolved.projectId || keepRaw.projectId,
    baseMapId: keepResolved.baseMapId,
  };
}
