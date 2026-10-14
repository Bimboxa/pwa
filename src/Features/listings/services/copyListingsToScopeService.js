import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
import {
  remapPointIds,
  remapAnnotationIds,
} from "Features/annotations/utils/remapAnnotationRefs";
import {
  buildMeshPaintCopiesForDuplicate,
  getLiveMeshPaintsByHostIds,
} from "Features/meshPaint/services/copyMeshPaintsService";
import {
  prepareCopy,
  copyNotesAppConfig,
} from "Features/scopes/services/duplicateScopeService";

const notDeleted = (r) => r && !r.deletedAt;

/**
 * Copy listings of ANOTHER scope into a host scope (« Krto source » at scope
 * creation, "Copier les annotations" mode): new ids for the listings, their
 * annotation templates, entities, annotations, points and annotation rels
 * (mesh cells, subtractions, openings, mapping categories, painted mesh
 * parts); ownership reassigned to `createdBy` (prepareCopy strips the audit
 * fields so the db creating hook re-stamps the copies). The copies are ranked
 * after the host's own listings.
 *
 * Per-listing subset of duplicateScopeService: scope-level content (layers,
 * baseMapViews, dimensions3d, scopeConfig, resources, templateless
 * annotations) is NOT copied — copied annotations land in « Calque 0 »
 * (layerId null). BaseMaps are project-level and never duplicated.
 *
 * Returns { newListingIds, annotationsCount }.
 */
export default async function copyListingsToScopeService({
  hostScope,
  listings,
  createdBy,
}) {
  const sourceListings = (listings ?? []).filter(
    (l) => notDeleted(l) && l.scopeId && l.scopeId !== hostScope?.id
  );
  if (!hostScope?.id || sourceListings.length === 0) {
    return { newListingIds: [], annotationsCount: 0 };
  }
  const listingIds = sourceListings.map((l) => l.id);

  // read - listings content (parallel)

  const [sourceTemplates, sourceAnnotations, hostListings] = await Promise.all([
    db.annotationTemplates
      .where("listingId")
      .anyOf(listingIds)
      .toArray()
      .then((rows) => rows.filter(notDeleted)),
    db.annotations
      .where("listingId")
      .anyOf(listingIds)
      .toArray()
      .then((rows) => rows.filter(notDeleted)),
    db.listings
      .where("scopeId")
      .equals(hostScope.id)
      .toArray()
      .then((rows) => rows.filter(notDeleted)),
  ]);

  // read - points, entities, rels of the annotations (parallel)

  const annotationIds = sourceAnnotations.map((a) => a.id);
  const pointIds = collectReferencedPointIds(sourceAnnotations);

  const entityIdsByTable = {};
  const listingById = {};
  sourceListings.forEach((l) => (listingById[l.id] = l));
  sourceAnnotations.forEach((a) => {
    if (!a.entityId) return;
    const listing = listingById[a.listingId];
    const table =
      listing?.table ?? listing?.entityModel?.defaultTable ?? "entities";
    if (!entityIdsByTable[table]) entityIdsByTable[table] = new Set();
    entityIdsByTable[table].add(a.entityId);
  });

  const [
    sourcePoints,
    meshRels,
    subtractionRels,
    openingRels,
    mappingRels,
    meshPaints,
    entityGroups,
  ] = await Promise.all([
    pointIds.size > 0
      ? db.points.bulkGet([...pointIds]).then((rows) => rows.filter(notDeleted))
      : [],
    annotationIds.length > 0
      ? db.relAnnotationMeshCells
          .where("parentAnnotationId")
          .anyOf(annotationIds)
          .toArray()
          .then((rows) => rows.filter(notDeleted))
      : [],
    annotationIds.length > 0
      ? db.relAnnotationSubtractions
          .where("sourceAnnotationId")
          .anyOf(annotationIds)
          .toArray()
          .then((rows) => rows.filter(notDeleted))
      : [],
    annotationIds.length > 0
      ? db.relAnnotationOpenings
          .where("hostAnnotationId")
          .anyOf(annotationIds)
          .toArray()
          .then((rows) => rows.filter(notDeleted))
      : [],
    annotationIds.length > 0
      ? db.relAnnotationMappingCategory
          .where("annotationId")
          .anyOf(annotationIds)
          .toArray()
          .then((rows) => rows.filter(notDeleted))
      : [],
    getLiveMeshPaintsByHostIds(annotationIds),
    Promise.all(
      Object.entries(entityIdsByTable).map(async ([table, ids]) => ({
        table,
        rows: (await db.table(table).bulkGet([...ids])).filter(notDeleted),
      }))
    ),
  ]);

  // id maps (upfront so intra-batch references can be remapped)

  const buildIdMap = (records) => {
    const map = {};
    records.forEach((r) => (map[r.id] = nanoid()));
    return map;
  };
  const listingIdMap = buildIdMap(sourceListings);
  const templateIdMap = buildIdMap(sourceTemplates);
  const annotationIdMap = buildIdMap(sourceAnnotations);
  const pointIdMap = buildIdMap(sourcePoints);
  const entityIdMap = {};
  entityGroups.forEach((g) =>
    g.rows.forEach((e) => (entityIdMap[e.id] = nanoid()))
  );

  // remap in memory

  // ranks: after the host's own listings (fractional indexing chain)
  let prevRank =
    hostListings
      .map((l) => l.rank)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

  const newListings = sourceListings.map((l) => {
    const rank = generateKeyBetween(prevRank, null);
    prevRank = rank;
    const copy = {
      ...prepareCopy(l, createdBy),
      id: listingIdMap[l.id],
      scopeId: hostScope.id,
      projectId: hostScope.projectId ?? l.projectId,
      rank,
    };
    // Krnet link is per listing: dropped on the copy (config kept)
    delete copy.idMaster;
    delete copy.remoteSource;
    if (l.notesApp)
      copy.notesApp = copyNotesAppConfig(l.notesApp, listingIdMap);
    return copy;
  });

  const newTemplates = sourceTemplates.map((t) => ({
    ...prepareCopy(t, createdBy),
    id: templateIdMap[t.id],
    listingId: listingIdMap[t.listingId],
  }));

  const newPoints = sourcePoints.map((p) => ({
    ...prepareCopy(p, createdBy),
    id: pointIdMap[p.id],
    // the copy lives entirely in the host scope (see duplicateScopeService:
    // the creating hook can't stamp it under withSystemWrite)
    scopeId: hostScope.id,
    listingId: listingIdMap[p.listingId] ?? p.listingId,
  }));

  const newEntityGroups = entityGroups.map((g) => ({
    table: g.table,
    rows: g.rows.map((e) => ({
      ...prepareCopy(e, createdBy),
      id: entityIdMap[e.id],
      listingId: listingIdMap[e.listingId] ?? e.listingId,
    })),
  }));

  const newAnnotations = sourceAnnotations.map((a) => {
    const newAnn = {
      ...prepareCopy(a, createdBy),
      id: annotationIdMap[a.id],
      listingId: listingIdMap[a.listingId],
      annotationTemplateId: a.annotationTemplateId
        ? (templateIdMap[a.annotationTemplateId] ?? a.annotationTemplateId)
        : a.annotationTemplateId,
      entityId: a.entityId
        ? (entityIdMap[a.entityId] ?? a.entityId)
        : a.entityId,
      // layers are scope-bound and not copied: « Calque 0 »
      layerId: null,
    };
    remapPointIds(newAnn, pointIdMap);
    remapAnnotationIds(newAnn, annotationIdMap);
    return newAnn;
  });

  // rels: only when both endpoints are in the copied set
  const newMeshRels = meshRels
    .filter(
      (r) =>
        annotationIdMap[r.parentAnnotationId] &&
        annotationIdMap[r.meshCellAnnotationId]
    )
    .map((r) => ({
      ...prepareCopy(r, createdBy),
      id: nanoid(),
      parentAnnotationId: annotationIdMap[r.parentAnnotationId],
      meshCellAnnotationId: annotationIdMap[r.meshCellAnnotationId],
    }));

  const newSubtractionRels = subtractionRels
    .filter(
      (r) =>
        annotationIdMap[r.sourceAnnotationId] &&
        annotationIdMap[r.targetAnnotationId]
    )
    .map((r) => ({
      ...prepareCopy(r, createdBy),
      id: nanoid(),
      sourceAnnotationId: annotationIdMap[r.sourceAnnotationId],
      targetAnnotationId: annotationIdMap[r.targetAnnotationId],
    }));

  // opening rels: both annotation ids AND the anchor point ids
  const newOpeningRels = openingRels
    .filter(
      (r) =>
        annotationIdMap[r.hostAnnotationId] &&
        annotationIdMap[r.openingAnnotationId]
    )
    .map((r) => ({
      ...prepareCopy(r, createdBy),
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
      carve: r.carve
        ? {
            ...r.carve,
            ...(Array.isArray(r.carve.notchPointIds) && {
              notchPointIds: r.carve.notchPointIds.map(
                (pid) => pointIdMap[pid] ?? pid
              ),
            }),
          }
        : r.carve,
    }));

  const newMappingRels = mappingRels
    .filter((r) => annotationIdMap[r.annotationId])
    .map((r) => ({
      ...prepareCopy(r, createdBy),
      id: nanoid(),
      annotationId: annotationIdMap[r.annotationId],
    }));

  const sourceHostById = {};
  sourceAnnotations.forEach((a) => (sourceHostById[a.id] = a));

  // write: single transaction (see duplicateScopeService)

  const entityTables = [...new Set(newEntityGroups.map((g) => g.table))].map(
    (t) => db.table(t)
  );

  await withSystemWrite(() =>
    withoutUndo(() =>
      db.transaction(
        "rw",
        [
          db.listings,
          db.annotationTemplates,
          ...entityTables,
          db.points,
          db.annotations,
          db.relAnnotationMeshCells,
          db.relAnnotationSubtractions,
          db.relAnnotationOpenings,
          db.relAnnotationMappingCategory,
          db.meshPaints,
        ],
        async () => {
          await db.listings.bulkAdd(newListings);
          if (newTemplates.length > 0)
            await db.annotationTemplates.bulkAdd(newTemplates);
          for (const g of newEntityGroups) {
            if (g.rows.length > 0) await db.table(g.table).bulkAdd(g.rows);
          }
          if (newPoints.length > 0) await db.points.bulkAdd(newPoints);
          if (newAnnotations.length > 0)
            await db.annotations.bulkAdd(newAnnotations);
          if (newMeshRels.length > 0)
            await db.relAnnotationMeshCells.bulkAdd(newMeshRels);
          if (newSubtractionRels.length > 0)
            await db.relAnnotationSubtractions.bulkAdd(newSubtractionRels);
          if (newOpeningRels.length > 0)
            await db.relAnnotationOpenings.bulkAdd(newOpeningRels);
          if (newMappingRels.length > 0)
            await db.relAnnotationMappingCategory.bulkAdd(newMappingRels);
          const newMeshPaints = buildMeshPaintCopiesForDuplicate({
            rows: meshPaints,
            annotationIdMap,
            templateIdMap,
            listingIdMap,
            sourceHostById,
            scopeId: hostScope.id,
            syncedAt: new Date().toISOString(),
          });
          if (newMeshPaints.length > 0)
            await db.meshPaints.bulkAdd(newMeshPaints);
        }
      )
    )
  );

  return {
    newListingIds: newListings.map((l) => l.id),
    annotationsCount: newAnnotations.length,
  };
}
