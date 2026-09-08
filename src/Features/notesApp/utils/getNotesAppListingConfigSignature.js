// Change detection of a Krnet listing configuration.
//
// Remote signature = the most recent updatedAt (ms) across the listing row,
// its entity model, its state models and its listing_state_models rows —
// tombstones included, so a deletion is a change. Stored on the local
// listing as notesApp.remoteUpdatedAt (the sync cursor).
//
// The local side is NOT keyed on listing.updatedAt: that stamp moves on
// every listing write (rename, showNumbering, the sync's own creation...)
// and would block every pull. notesApp.localUpdatedAt is stamped only by
// the config hook (and the name handler); null = clean since the last sync.

function ts(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function getRemoteListingConfigSignature({
  remoteListing,
  remoteEntityModel,
  remoteStateModels,
  remoteListingStateModels,
}) {
  let max = ts(remoteListing?.updatedAt);
  max = Math.max(max, ts(remoteEntityModel?.updatedAt));
  for (const sm of remoteStateModels ?? [])
    max = Math.max(max, ts(sm?.updatedAt));
  for (const lsm of remoteListingStateModels ?? []) {
    max = Math.max(max, ts(lsm?.updatedAt));
  }
  return max;
}

export function isListingConfigDirty(listing) {
  const local = listing?.notesApp;
  if (!local?.localUpdatedAt) return false;
  const localMs = Date.parse(local.localUpdatedAt) || 0;
  return localMs > ts(local.remoteUpdatedAt);
}
