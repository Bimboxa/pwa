import remapNotesAppListingRefs from "./remapNotesAppListingRefs";
import { stripLegacyNameField, parseSettings } from "./notesAppListingSettings";
import {
  getRemoteListingConfigSignature,
  isListingConfigDirty,
} from "./getNotesAppListingConfigSignature";

// Pure core of the listing-configuration PULL merge: from the remote rows of
// one Krnet list (listing + entity model + state models + listing_state_
// models, tombstones included) and the local Bimboxa listing, returns the
// db.listings patch to apply (or null) and the decision taken.
//
// Decision (last-modified-wins on the CONFIG stamps, see
// getNotesAppListingConfigSignature):
// - never linked (no notesApp block)       -> apply, local name kept
// - signature <= notesApp.remoteUpdatedAt  -> unchanged
// - local config clean                     -> apply
// - local dirty, remote newer than the local edit -> apply (remote won)
// - local dirty and newer                  -> keepLocal (pushed later)
//
// The patch never carries updatedAt: the db `updating` hook stamps now.

function toIso(ms) {
  return ms ? new Date(ms).toISOString() : undefined;
}

function assembleStateModels({ remoteStateModels, remoteListingStateModels }) {
  // one lsm per state model — prefer the live row over a tombstone
  const lsmBySmId = new Map();
  for (const lsm of remoteListingStateModels ?? []) {
    if (!lsm?.stateModelId) continue;
    const existing = lsmBySmId.get(lsm.stateModelId);
    if (!existing || (existing.deletedAt && !lsm.deletedAt)) {
      lsmBySmId.set(lsm.stateModelId, lsm);
    }
  }
  return (remoteStateModels ?? []).map((sm) => {
    const lsm = lsmBySmId.get(sm.id);
    const visible = lsm ? Boolean(lsm.visible ?? true) : true;
    return {
      id: sm.id,
      name: sm.name ?? "",
      states: Array.isArray(sm.states) ? sm.states : [],
      transitions: Array.isArray(sm.transitions) ? sm.transitions : [],
      settings:
        sm.settings && typeof sm.settings === "object" ? sm.settings : {},
      visible,
      navName: lsm?.name ?? sm.name ?? "",
      listingStateModelId: lsm?.id ?? null,
      updatedAt: Math.max(sm.updatedAt ?? 0, lsm?.updatedAt ?? 0),
      ...(sm.deletedAt && { deletedAt: toIso(sm.deletedAt) }),
    };
  });
}

export default function buildNotesAppListingConfigPatch({
  listing,
  remoteListing,
  remoteEntityModel,
  remoteStateModels,
  remoteListingStateModels,
  remoteToLocalListingId,
}) {
  const signature = getRemoteListingConfigSignature({
    remoteListing,
    remoteEntityModel,
    remoteStateModels,
    remoteListingStateModels,
  });
  const local = listing?.notesApp ?? null;

  let decision;
  if (!local) decision = "apply";
  else if (signature <= (local.remoteUpdatedAt ?? 0)) decision = "unchanged";
  else if (!isListingConfigDirty(listing)) decision = "apply";
  else if (signature > (Date.parse(local.localUpdatedAt) || 0)) {
    decision = "remoteWon";
  } else decision = "keepLocal";

  if (decision === "unchanged" || decision === "keepLocal") {
    return { patch: null, decision, signature };
  }

  const rawSettings =
    typeof remoteListing?.settings === "string"
      ? {}
      : parseSettings(remoteListing?.settings);
  const settings = remapNotesAppListingRefs(
    stripLegacyNameField(rawSettings),
    remoteToLocalListingId
  );

  const stateModels = assembleStateModels({
    remoteStateModels,
    remoteListingStateModels,
  });
  // state models created in Bimboxa and never pushed: the remote cannot
  // know them, keep them
  const localOnly = (local?.stateModels ?? []).filter(
    (sm) =>
      sm?.isLocalOnly &&
      !sm.deletedAt &&
      !stateModels.some((r) => r.id === sm.id)
  );

  const patch = {
    idMaster: remoteListing.id,
    remoteSource: "notesApp",
    // first link keeps the Bimboxa name; afterwards the remote name follows
    ...(local && remoteListing.name && { name: remoteListing.name }),
    notesApp: {
      settings,
      stateModels: [...stateModels, ...localOnly],
      entityModelId:
        remoteListing.entityModelId ?? local?.entityModelId ?? null,
      icon: remoteListing.icon ?? null,
      color: remoteListing.color ?? null,
      remoteUpdatedAt: signature,
      localUpdatedAt: null,
    },
  };
  return { patch, decision, signature };
}
