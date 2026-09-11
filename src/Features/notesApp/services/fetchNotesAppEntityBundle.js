import { getNotesAppClient } from "./notesAppClient";

import normalizeNotesAppRow from "../utils/normalizeNotesAppRow";
import { isShapeType } from "../utils/mapNotesAppShapeToAnnotation";
import {
  buildNotesAppEntityDumps,
  getRelatedEntityIds,
} from "../utils/buildNotesAppEntityDumps";

// Remote rows of ONE notes-app object (Krnet entity) and of its related
// objects, shaped as mini project dumps (same keys and row normalization as
// fetchNotesAppProjectDump) so the per-object pull reuses the scope merges
// untouched. Plain PostgREST selects: every table is readable with the user
// session through the project-access RLS, no dedicated RPC involved.
//
// Related objects = targets of the object's live links (Krnet `links`,
// linkSingle / linkMulti fields), its category objects
// (settings.categories) and the objects co-linked to one of its shapes
// (rels_entity_annotation). They travel WITH their notes and links: the
// objects merge keys the notes feed and the links on their own signatures,
// an object present in the dump without them would be reset to empty.
//
// Shapes: every rel of a shape is fetched, whatever the object — the shapes
// merge tombstones the local rels of the objects missing from the dump.

// Shared with fetchNotesAppListingBundle (same PostgREST access pattern).
export const LISTING_COLUMNS =
  "id,name,icon,color,settings,updated_at,deleted_at";
const IN_CHUNK = 200;

function unique(ids) {
  return [...new Set((ids ?? []).filter(Boolean))];
}

export async function selectIn(client, table, column, ids, columns = "*") {
  const list = unique(ids);
  const rows = [];
  for (let i = 0; i < list.length; i += IN_CHUNK) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .in(column, list.slice(i, i + IN_CHUNK));
    if (error) throw error;
    rows.push(...(data ?? []).map(normalizeNotesAppRow));
  }
  return rows;
}

export function dedupeById(rows) {
  const byId = new Map();
  for (const row of rows) if (row?.id) byId.set(row.id, row);
  return [...byId.values()];
}

export default async function fetchNotesAppEntityBundle({ entityId }) {
  const client = getNotesAppClient();

  const [entity = null] = await selectIn(client, "entities", "id", [entityId]);
  if (!entity) {
    return {
      entity: null,
      relatedEntities: [],
      remoteListingById: new Map(),
      ...buildNotesAppEntityDumps({ entity: { id: entityId } }),
    };
  }

  // --- wave 1: the object's own links, rels and MARKER positions
  const [ownLinks, ownRels, ownAnnotations] = await Promise.all([
    selectIn(client, "links", "source_entity_id", [entityId]),
    selectIn(client, "rels_entity_annotation", "entity_id", [entityId]),
    selectIn(client, "annotations", "entity_id", [entityId]),
  ]);

  // --- wave 2: rel-linked annotations (shapes) + every rel of those shapes
  const ownAnnotationIds = new Set(ownAnnotations.map((a) => a.id));
  const linkedAnnotations = await selectIn(
    client,
    "annotations",
    "id",
    ownRels.map((r) => r.annotationId).filter((id) => !ownAnnotationIds.has(id))
  );
  const annotations = dedupeById([...ownAnnotations, ...linkedAnnotations]);
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

  // --- wave 3: related objects with their notes, links and lists
  const relatedIds = getRelatedEntityIds({
    entity,
    links: ownLinks,
    relsEntityAnnotation,
  });
  const relatedEntities = await selectIn(client, "entities", "id", relatedIds);
  const allEntityIds = [entityId, ...relatedEntities.map((e) => e.id)];
  const [notes, links, listings] = await Promise.all([
    selectIn(client, "notes", "entity_id", allEntityIds),
    selectIn(client, "links", "source_entity_id", allEntityIds),
    selectIn(
      client,
      "listings",
      "id",
      [entity.listingId, ...relatedEntities.map((e) => e.listingId)],
      LISTING_COLUMNS
    ),
  ]);

  return {
    entity,
    relatedEntities,
    remoteListingById: new Map(listings.map((l) => [l.id, l])),
    ...buildNotesAppEntityDumps({
      entity,
      relatedEntities,
      notes,
      links,
      annotations,
      relsEntityAnnotation,
    }),
  };
}
