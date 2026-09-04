import db from "App/db/db";

// scope.notesApp is the single source of truth of the notes-app integration:
// { projectId, projectName, linkedAt, lastSyncAt, lastSyncStatus,
//   listingsMapping: [{ remoteListingId, remoteListingName,
//     localListingId | null, mode: "mapped" | "ignored",
//     lastSyncAt, lastSyncCounts }] }
//
// Remote lists WITHOUT a mapping entry default to "create a linked listing"
// at sync time — only explicit choices (existing listing, ignore) and
// sync-created mappings are persisted.

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
    },
  });
}

export async function unlinkScopeFromNotesAppProject(scopeId) {
  await db.scopes.update(scopeId, { notesApp: null });
}

export function upsertMappingEntry(listingsMapping, entry) {
  const mapping = [...(listingsMapping ?? [])];
  const index = mapping.findIndex(
    (m) => m.remoteListingId === entry.remoteListingId
  );
  if (index >= 0) mapping[index] = { ...mapping[index], ...entry };
  else mapping.push(entry);
  return mapping;
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
