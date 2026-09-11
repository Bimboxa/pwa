// Pure helpers of the per-object pull (fetchNotesAppEntityBundle): which
// objects are related to a Krnet entity, and the mini dumps handed to the
// scope merges. No Dexie, no Supabase (replayable in node).

function dedupeById(rows) {
  const byId = new Map();
  for (const row of rows) if (row?.id) byId.set(row.id, row);
  return [...byId.values()];
}

// Ids of the objects related to `entity` (pure): live link targets,
// category objects, objects sharing a rel-linked annotation.
export function getRelatedEntityIds({ entity, links, relsEntityAnnotation }) {
  const ids = new Set();
  for (const link of links ?? []) {
    if (link.deletedAt || link.sourceEntityId !== entity.id) continue;
    if (link.targetEntityId) ids.add(link.targetEntityId);
  }
  const categories = entity.settings?.categories;
  if (categories && typeof categories === "object") {
    for (const value of Object.values(categories)) {
      if (typeof value === "string" && value) ids.add(value);
    }
  }
  for (const rel of relsEntityAnnotation ?? []) {
    if (!rel.deletedAt && rel.entityId) ids.add(rel.entityId);
  }
  ids.delete(entity.id);
  return [...ids];
}

// Mini dumps (pure): the objects merge reads entities + notes + links, the
// positions / shapes merges read entities + annotations + rels. `entities`
// are the objects the pull is about (one object, or every object of a
// list), `relatedEntities` their link / category / shared-shape targets.
export function buildNotesAppEntitiesDumps({
  entities = [],
  relatedEntities = [],
  notes = [],
  links = [],
  annotations = [],
  relsEntityAnnotation = [],
}) {
  const allEntities = dedupeById([...entities, ...relatedEntities]);
  return {
    objectsDump: { entities: allEntities, notes, links },
    shapesDump: {
      entities: allEntities,
      annotations: dedupeById(annotations),
      relsEntityAnnotation: dedupeById(relsEntityAnnotation),
    },
  };
}

// Single-object variant (per-object pull).
export function buildNotesAppEntityDumps({ entity, ...rest }) {
  return buildNotesAppEntitiesDumps({ entities: [entity], ...rest });
}
