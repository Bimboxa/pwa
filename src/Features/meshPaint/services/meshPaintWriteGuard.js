import store from "App/store";

// Painted parts the db linked-listing guard refuses to write in the selected
// scope: paints made with a template of a listing LINKED into it — i.e. the
// paints another scope made on a host of this one, when the two scopes link
// each other's listings. A user edit of the host here (move, delete, 2D
// split) must not abort on them: its cascades leave those rows to their own
// scope (re-sync, purge), where they are writable.
//
// Mirrors assertNotLinkedListingContent (App/db/db.js).

export function isMeshPaintLinkedHere(row) {
  if (!row?.listingId) return false;
  const state = store.getState();
  const scopeId = state?.scopes?.selectedScopeId;
  if (!scopeId) return false;
  return Boolean(
    state?.listings?.linkedListingSourceByScopeId?.[scopeId]?.[row.listingId]
  );
}

/**
 * @param {Object[]} rows - db.meshPaints rows
 * @returns {Object[]} the rows a user cascade may write in the selected scope
 */
export function filterMeshPaintsWritableHere(rows) {
  return (rows ?? []).filter((row) => !isMeshPaintLinkedHere(row));
}
