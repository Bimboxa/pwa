import db from "App/db/db";

// scope.notesApp is the single source of truth of the notes-app integration:
// { projectId, projectName, linkedAt, lastSyncAt, lastSyncStatus,
//   listingsMapping: [{ remoteListingId, remoteListingName,
//     localListingId | null, mode: "mapped" | "ignored",
//     lastSyncAt, lastSyncCounts }],
//   baseMapsMapping: [{ remoteBaseMapId, remoteBaseMapName,
//     localListingId | null, mode: "mapped" | "ignored", lastSyncAt }] }
//
// Remote lists WITHOUT a mapping entry default to "create a linked listing"
// at sync time — only explicit choices (existing listing, ignore) and
// sync-created mappings are persisted.
// Remote plans WITHOUT a mapping entry land in the project's default
// BASE_MAP listing (key "mapsGeneric", else the first one, else created from
// the preset); an explicit entry targets another base-map listing of the
// project or ignores the plan (a previously imported plan is left untouched).

export function getNotesAppScopeLink(scope) {
  return scope?.notesApp ?? null;
}

export async function linkScopeToNotesAppProject({
  scopeId,
  projectId,
  projectName,
}) {
  await db.scopes.update(scopeId, {
    notesApp: {
      projectId,
      projectName,
      linkedAt: new Date().toISOString(),
      lastSyncAt: null,
      lastSyncStatus: null,
      listingsMapping: [],
      baseMapsMapping: [],
    },
  });
}

export async function unlinkScopeFromNotesAppProject(scopeId) {
  await db.scopes.update(scopeId, { notesApp: null });
}

function upsertEntry(mapping, entry, keyField) {
  const next = [...(mapping ?? [])];
  const index = next.findIndex((m) => m[keyField] === entry[keyField]);
  if (index >= 0) next[index] = { ...next[index], ...entry };
  else next.push(entry);
  return next;
}

// --- listings mapping

export function upsertMappingEntry(listingsMapping, entry) {
  return upsertEntry(listingsMapping, entry, "remoteListingId");
}

export async function setNotesAppListingMapping({
  scope,
  remoteListingId,
  remoteListingName,
  localListingId,
  mode,
}) {
  const link = scope?.notesApp;
  if (!link) return;
  const listingsMapping = upsertMappingEntry(link.listingsMapping, {
    remoteListingId,
    remoteListingName,
    localListingId: localListingId ?? null,
    mode: mode ?? (localListingId ? "mapped" : "ignored"),
  });
  await db.scopes.update(scope.id, {
    notesApp: { ...link, listingsMapping },
  });
}

export async function clearNotesAppListingMapping({ scope, remoteListingId }) {
  const link = scope?.notesApp;
  if (!link) return;
  const listingsMapping = (link.listingsMapping ?? []).filter(
    (m) => m.remoteListingId !== remoteListingId
  );
  await db.scopes.update(scope.id, {
    notesApp: { ...link, listingsMapping },
  });
}

// --- base maps (plans) mapping

export function upsertBaseMapMappingEntry(baseMapsMapping, entry) {
  return upsertEntry(baseMapsMapping, entry, "remoteBaseMapId");
}

export async function setNotesAppBaseMapMapping({
  scope,
  remoteBaseMapId,
  remoteBaseMapName,
  localListingId,
  mode,
}) {
  const link = scope?.notesApp;
  if (!link) return;
  const baseMapsMapping = upsertBaseMapMappingEntry(link.baseMapsMapping, {
    remoteBaseMapId,
    remoteBaseMapName,
    localListingId: localListingId ?? null,
    mode: mode ?? (localListingId ? "mapped" : "ignored"),
  });
  await db.scopes.update(scope.id, {
    notesApp: { ...link, baseMapsMapping },
  });
}

export async function clearNotesAppBaseMapMapping({ scope, remoteBaseMapId }) {
  const link = scope?.notesApp;
  if (!link) return;
  const baseMapsMapping = (link.baseMapsMapping ?? []).filter(
    (m) => m.remoteBaseMapId !== remoteBaseMapId
  );
  await db.scopes.update(scope.id, {
    notesApp: { ...link, baseMapsMapping },
  });
}
