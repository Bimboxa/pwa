import { getNotesAppClient } from "./notesAppClient";
import {
  selectIn,
  dedupeById,
  LISTING_COLUMNS,
} from "./fetchNotesAppEntityBundle";

import { isShapeType } from "../utils/mapNotesAppShapeToAnnotation";
import {
  buildNotesAppEntitiesDumps,
  getRelatedEntityIds,
} from "../utils/buildNotesAppEntityDumps";

// Remote rows of ONE notes-app list (Krnet listing): every object of the
// list (tombstones included, so deletions propagate), their notes feed,
// links, positions and shapes, their related objects, and the list
// configuration rows (entity model, state models, listing state models).
// Same PostgREST access pattern and the same mini-dump shape as the
// per-object bundle (fetchNotesAppEntityBundle), so the scope merges run
// untouched — see that file for the related-objects / shared-rels traps.
//
// Shapes of the list = the MARKER positions of its objects (entity_id), the
// drawings owned by the list (listing_id) and the drawings rel-linked to
// one of its objects (listing_id null) — the three cases the shapes and
// positions merges filter on.

export default async function fetchNotesAppListingBundle({ remoteListingId }) {
  const client = getNotesAppClient();

  // full row: entity_model_id drives the listing configuration merge
  const [remoteListing = null] = await selectIn(client, "listings", "id", [
    remoteListingId,
  ]);
  if (!remoteListing) {
    return {
      remoteListing: null,
      entities: [],
      relatedEntities: [],
      remoteListingById: new Map(),
      configDump: { entityModels: [], stateModels: [], listingStateModels: [] },
      ...buildNotesAppEntitiesDumps({}),
    };
  }

  // --- wave 0: the objects of the list + the configuration rows
  const entityModelId = remoteListing.entityModelId ?? null;
  const [entities, entityModels, stateModels, listingStateModels] =
    await Promise.all([
      selectIn(client, "entities", "listing_id", [remoteListingId]),
      entityModelId
        ? selectIn(client, "entity_models", "id", [entityModelId])
        : Promise.resolve([]),
      entityModelId
        ? selectIn(client, "state_models", "entity_model_id", [entityModelId])
        : Promise.resolve([]),
      selectIn(client, "listing_state_models", "listing_id", [remoteListingId]),
    ]);
  const entityIds = entities.map((e) => e.id);
  const entityIdSet = new Set(entityIds);

  // --- wave 1: own links, rels, MARKER positions + list-owned drawings
  const [ownLinks, ownRels, ownAnnotations, listingAnnotations] =
    await Promise.all([
      selectIn(client, "links", "source_entity_id", entityIds),
      selectIn(client, "rels_entity_annotation", "entity_id", entityIds),
      selectIn(client, "annotations", "entity_id", entityIds),
      selectIn(client, "annotations", "listing_id", [remoteListingId]),
    ]);

  // --- wave 2: rel-linked annotations (shapes) + every rel of those shapes
  const knownAnnotations = dedupeById([
    ...ownAnnotations,
    ...listingAnnotations,
  ]);
  const knownAnnotationIds = new Set(knownAnnotations.map((a) => a.id));
  const linkedAnnotations = await selectIn(
    client,
    "annotations",
    "id",
    ownRels
      .map((r) => r.annotationId)
      .filter((id) => !knownAnnotationIds.has(id))
  );
  const annotations = dedupeById([...knownAnnotations, ...linkedAnnotations]);
  const shapeIds = annotations
    .filter((a) => isShapeType(a.type))
    .map((a) => a.id);
  const sharedRels = await selectIn(
    client,
    "rels_entity_annotation",
    "annotation_id",
    shapeIds
  );
  const relsEntityAnnotation = dedupeById([...ownRels, ...sharedRels]);

  // --- wave 3: related objects (outside the list) with their notes, links
  // and lists
  const relatedIds = new Set();
  for (const entity of entities) {
    for (const id of getRelatedEntityIds({
      entity,
      links: ownLinks,
      relsEntityAnnotation,
    })) {
      if (!entityIdSet.has(id)) relatedIds.add(id);
    }
  }
  const relatedEntities = await selectIn(client, "entities", "id", [
    ...relatedIds,
  ]);
  const allEntityIds = [...entityIds, ...relatedEntities.map((e) => e.id)];
  const [notes, links, relatedListings] = await Promise.all([
    selectIn(client, "notes", "entity_id", allEntityIds),
    selectIn(client, "links", "source_entity_id", allEntityIds),
    selectIn(
      client,
      "listings",
      "id",
      relatedEntities
        .map((e) => e.listingId)
        .filter((id) => id && id !== remoteListingId),
      LISTING_COLUMNS
    ),
  ]);

  return {
    remoteListing,
    entities,
    relatedEntities,
    remoteListingById: new Map(
      [remoteListing, ...relatedListings].map((l) => [l.id, l])
    ),
    configDump: { entityModels, stateModels, listingStateModels },
    ...buildNotesAppEntitiesDumps({
      entities,
      relatedEntities,
      notes,
      links,
      annotations,
      relsEntityAnnotation,
    }),
  };
}
