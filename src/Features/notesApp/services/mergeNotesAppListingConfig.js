import buildNotesAppListingConfigPatch from "../utils/buildNotesAppListingConfigPatch";

// Prepares the listing-configuration patch of one mapped (remote list ->
// "Ouvrages" listing) pair: gathers the remote rows from the dump
// (tombstones included, so deletions propagate) and delegates to the pure
// builder. No write: the orchestrator applies the patch in its transaction.
export default async function prepareNotesAppListingConfigMerge({
  dump,
  remoteListing,
  listing,
  remoteToLocalListingId,
}) {
  const entityModelId = remoteListing.entityModelId ?? null;
  const remoteEntityModel = entityModelId
    ? ((dump.entityModels ?? []).find((em) => em.id === entityModelId) ?? null)
    : null;
  const remoteStateModels = entityModelId
    ? (dump.stateModels ?? []).filter(
        (sm) => sm.entityModelId === entityModelId
      )
    : [];
  const remoteListingStateModels = (dump.listingStateModels ?? []).filter(
    (lsm) => lsm.listingId === remoteListing.id
  );

  const { patch, decision } = buildNotesAppListingConfigPatch({
    listing,
    remoteListing,
    remoteEntityModel,
    remoteStateModels,
    remoteListingStateModels,
    remoteToLocalListingId,
  });

  return {
    patch,
    counts: {
      applied: patch ? 1 : 0,
      conflictsRemoteWon: decision === "remoteWon" ? 1 : 0,
      conflictsLocalKept: decision === "keepLocal" ? 1 : 0,
    },
  };
}
