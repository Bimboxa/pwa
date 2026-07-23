import { nanoid } from "@reduxjs/toolkit";

import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
import {
  remapPointIds,
  remapAnnotationIds,
} from "Features/annotations/utils/remapAnnotationRefs";

export const NO_LAYER_ID = "__no_layer__";
export const NO_TEMPLATE_KEY_PREFIX = "__no_template__:";

export function getAnnotationTemplateKey(annotation) {
  return (
    annotation.annotationTemplateId ??
    NO_TEMPLATE_KEY_PREFIX + annotation.listingId
  );
}

export function getAnnotationLayerKey(annotation, liveLayerIds) {
  // a layerId pointing at a soft-deleted layer behaves as "Calque 0",
  // both in the dialog counts and in the copy filter.
  return annotation.layerId && liveLayerIds.has(annotation.layerId)
    ? annotation.layerId
    : NO_LAYER_ID;
}

// Every copy is born as a fresh record of the current user: the db "creating"
// audit hook re-stamps createdAt / createdByUserIdMaster once these fields are
// removed (it runs even under withSystemWrite).
function prepareCopy(record, createdBy) {
  const copy = { ...record };
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.createdByUserIdMaster;
  delete copy.updatedByUserIdMaster;
  delete copy.deletedAt;
  delete copy.deletedByUserIdMaster;
  if ("createdBy" in copy) copy.createdBy = createdBy;
  return copy;
}

const notDeleted = (r) => r && !r.deletedAt;

/**
 * Duplicate a scope: new ids for every record (scope, listings, templates,
 * layers, entities, annotations, points, rels, baseMapViews, dimensions3d),
 * single bulk transaction, ownership reassigned to the current user.
 *
 * Filters (disabled = unchecked in the dialog, empty array = keep everything):
 * - disabledBaseMapIds: annotations of these baseMaps are skipped.
 * - disabledLayerIds: layer ids and/or NO_LAYER_ID; unchecked layers are not
 *   recreated and their annotations are skipped.
 * - disabledTemplateKeys: template ids and/or NO_TEMPLATE_KEY_PREFIX+listingId;
 *   a listing with every displayed template key unchecked is not recreated.
 *
 * BaseMaps themselves are project-level and shared, never duplicated.
 * Soft-deleted records are never copied.
 */
export default async function duplicateScopeService({
  scope,
  name,
  createdBy,
  createdByTrigram = null,
  disabledBaseMapIds = [],
  disabledLayerIds = [],
  disabledTemplateKeys = [],
}) {
  // read - scoped listings

  const sourceListings = (
    await db.listings.where("scopeId").equals(scope.id).toArray()
  ).filter(notDeleted);
  const listingIds = sourceListings.map((l) => l.id);

  // read - scope content (parallel)

  const [
    sourceTemplates,
    sourceAnnotationsAll,
    sourceLayers,
    sourceBaseMapViews,
    sourceDimensions3d,
  ] = await Promise.all([
    listingIds.length > 0
      ? db.annotationTemplates
          .where("listingId")
          .anyOf(listingIds)
          .toArray()
          .then((rows) => rows.filter(notDeleted))
      : [],
    listingIds.length > 0
      ? db.annotations
          .where("listingId")
          .anyOf(listingIds)
          .toArray()
          .then((rows) => rows.filter(notDeleted))
      : [],
    db.layers
      .where("scopeId")
      .equals(scope.id)
      .toArray()
      .then((rows) => rows.filter(notDeleted)),
    db.baseMapViews
      .where("scopeId")
      .equals(scope.id)
      .toArray()
      .then((rows) => rows.filter(notDeleted)),
    db.dimensions3d
      .where("scopeId")
      .equals(scope.id)
      .toArray()
      .then((rows) => rows.filter(notDeleted)),
  ]);

  const liveLayerIds = new Set(sourceLayers.map((l) => l.id));

  // filter annotations (AND of the three filters)

  const disabledBaseMapSet = new Set(disabledBaseMapIds);
  const disabledLayerSet = new Set(disabledLayerIds);
  const disabledTemplateSet = new Set(disabledTemplateKeys);

  let keptAnnotations = sourceAnnotationsAll.filter((a) => {
    if (disabledBaseMapSet.has(a.baseMapId)) return false;
    if (disabledLayerSet.has(getAnnotationLayerKey(a, liveLayerIds)))
      return false;
    if (disabledTemplateSet.has(getAnnotationTemplateKey(a))) return false;
    return true;
  });

  // proxy closure: a proxy must not reference an annotation left in the
  // source scope — drop proxies whose source got filtered out, repeatedly
  // (a dropped proxy can itself be the source of another proxy).
  let dropped = true;
  while (dropped) {
    const keptIds = new Set(keptAnnotations.map((a) => a.id));
    const next = keptAnnotations.filter(
      (a) =>
        !a.proxy?.proxySourceAnnotationId ||
        keptIds.has(a.proxy.proxySourceAnnotationId)
    );
    dropped = next.length !== keptAnnotations.length;
    keptAnnotations = next;
  }

  // filtered structure: a listing is recreated iff at least one of its
  // annotation-bearing template keys is checked; its templates are recreated
  // unless explicitly unchecked (annotation-less templates are kept to
  // preserve the listing's authoring palette).

  const displayedTemplateKeysByListingId = {};
  sourceAnnotationsAll.forEach((a) => {
    if (!displayedTemplateKeysByListingId[a.listingId])
      displayedTemplateKeysByListingId[a.listingId] = new Set();
    displayedTemplateKeysByListingId[a.listingId].add(
      getAnnotationTemplateKey(a)
    );
  });

  const listingsToCopy = sourceListings.filter((l) => {
    const keys = displayedTemplateKeysByListingId[l.id];
    if (!keys) return false; // no annotations at all -> not shown, not copied
    return [...keys].some((key) => !disabledTemplateSet.has(key));
  });
  const listingIdsToCopy = new Set(listingsToCopy.map((l) => l.id));

  // annotations of dropped listings are dropped too (their proxies as well)
  keptAnnotations = keptAnnotations.filter((a) =>
    listingIdsToCopy.has(a.listingId)
  );

  const templatesToCopy = sourceTemplates.filter(
    (t) => listingIdsToCopy.has(t.listingId) && !disabledTemplateSet.has(t.id)
  );

  const layersToCopy = sourceLayers.filter((l) => !disabledLayerSet.has(l.id));

  const baseMapViewsToCopy = sourceBaseMapViews.filter(
    (v) => !disabledBaseMapSet.has(v.baseMapId)
  );

  // read - points, entities, rels of kept annotations (parallel)

  const keptAnnotationIds = keptAnnotations.map((a) => a.id);
  const pointIds = collectReferencedPointIds(keptAnnotations);

  const entityIdsByTable = {};
  const listingById = {};
  sourceListings.forEach((l) => (listingById[l.id] = l));
  keptAnnotations.forEach((a) => {
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
    entityGroups,
  ] =
    await Promise.all([
      pointIds.size > 0
        ? db.points
            .bulkGet([...pointIds])
            .then((rows) => rows.filter(notDeleted))
        : [],
      keptAnnotationIds.length > 0
        ? db.relAnnotationMeshCells
            .where("parentAnnotationId")
            .anyOf(keptAnnotationIds)
            .toArray()
            .then((rows) => rows.filter(notDeleted))
        : [],
      keptAnnotationIds.length > 0
        ? db.relAnnotationSubtractions
            .where("sourceAnnotationId")
            .anyOf(keptAnnotationIds)
            .toArray()
            .then((rows) => rows.filter(notDeleted))
        : [],
      keptAnnotationIds.length > 0
        ? db.relAnnotationOpenings
            .where("hostAnnotationId")
            .anyOf(keptAnnotationIds)
            .toArray()
            .then((rows) => rows.filter(notDeleted))
        : [],
      keptAnnotationIds.length > 0
        ? db.relAnnotationMappingCategory
            .where("annotationId")
            .anyOf(keptAnnotationIds)
            .toArray()
            .then((rows) => rows.filter(notDeleted))
        : [],
      Promise.all(
        Object.entries(entityIdsByTable).map(async ([table, ids]) => ({
          table,
          rows: (await db.table(table).bulkGet([...ids])).filter(notDeleted),
        }))
      ),
    ]);

  // id maps (upfront so intra-batch references can be remapped)

  const newScopeId = nanoid();
  const buildIdMap = (records) => {
    const map = {};
    records.forEach((r) => (map[r.id] = nanoid()));
    return map;
  };
  const listingIdMap = buildIdMap(listingsToCopy);
  const templateIdMap = buildIdMap(templatesToCopy);
  const layerIdMap = buildIdMap(layersToCopy);
  const annotationIdMap = buildIdMap(keptAnnotations);
  const pointIdMap = buildIdMap(sourcePoints);
  const entityIdMap = {};
  entityGroups.forEach((g) =>
    g.rows.forEach((e) => (entityIdMap[e.id] = nanoid()))
  );

  // remap in memory

  // A duplicate is the duplicator's own private copy.
  const newScope = {
    ...prepareCopy(scope, createdBy),
    id: newScopeId,
    name: name.trim(),
    createdBy,
    createdByTrigram,
    isPublic: false,
  };

  const newListings = listingsToCopy.map((l) => ({
    ...prepareCopy(l, createdBy),
    id: listingIdMap[l.id],
    scopeId: newScopeId,
  }));

  const newTemplates = templatesToCopy.map((t) => ({
    ...prepareCopy(t, createdBy),
    id: templateIdMap[t.id],
    listingId: listingIdMap[t.listingId],
  }));

  const newLayers = layersToCopy.map((l) => ({
    ...prepareCopy(l, createdBy),
    id: layerIdMap[l.id],
    scopeId: newScopeId,
  }));

  const newPoints = sourcePoints.map((p) => ({
    ...prepareCopy(p, createdBy),
    id: pointIdMap[p.id],
    // The copy lives entirely in the new scope: never carry the source
    // point's scopeId (a clear/restore of the SOURCE scope would otherwise
    // hard-delete the duplicated geometry). The creating hook can't stamp it
    // here — this runs under withSystemWrite.
    scopeId: newScopeId,
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

  const newAnnotations = keptAnnotations.map((a) => {
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
      // dangling / unchecked layer falls back to "Calque 0"
      layerId: a.layerId ? (layerIdMap[a.layerId] ?? null) : null,
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

  // Opening rels: remap both annotation ids AND the anchor point ids (the
  // anchor payload references db.points rows of the host contour).
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

  const newBaseMapViews = baseMapViewsToCopy.map((v) => ({
    ...prepareCopy(v, createdBy),
    id: nanoid(),
    scopeId: newScopeId,
  }));

  const newDimensions3d = sourceDimensions3d.map((d) => ({
    ...prepareCopy(d, createdBy),
    id: nanoid(),
    scopeId: newScopeId,
  }));

  // write: single transaction. withSystemWrite mutes per-record
  // notifyLocalChange, withoutUndo skips undo entries; one commit = one
  // liveQuery refresh.

  const entityTables = [...new Set(newEntityGroups.map((g) => g.table))].map(
    (t) => db.table(t)
  );

  await withSystemWrite(() =>
    withoutUndo(() =>
      db.transaction(
        "rw",
        [
          db.scopes,
          db.listings,
          db.annotationTemplates,
          db.layers,
          ...entityTables,
          db.points,
          db.annotations,
          db.relAnnotationMeshCells,
          db.relAnnotationSubtractions,
          db.relAnnotationOpenings,
          db.relAnnotationMappingCategory,
          db.baseMapViews,
          db.dimensions3d,
        ],
        async () => {
          await db.scopes.add(newScope);
          if (newListings.length > 0) await db.listings.bulkAdd(newListings);
          if (newTemplates.length > 0)
            await db.annotationTemplates.bulkAdd(newTemplates);
          if (newLayers.length > 0) await db.layers.bulkAdd(newLayers);
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
          if (newBaseMapViews.length > 0)
            await db.baseMapViews.bulkAdd(newBaseMapViews);
          if (newDimensions3d.length > 0)
            await db.dimensions3d.bulkAdd(newDimensions3d);
        }
      )
    )
  );

  return {
    newScopeId,
    firstListingId: newListings[0]?.id ?? null,
  };
}
