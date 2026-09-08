import { nanoid } from "nanoid";

import remapNotesAppListingRefs from "./remapNotesAppListingRefs";
import {
  collectNotesAppListingRefs,
  parseSettings,
} from "./notesAppListingSettings";
import { isListingConfigDirty } from "./getNotesAppListingConfigSignature";

// Pure core of the listing-configuration PUSH: from the business-object
// listings of a scope, builds the Supabase rows (snake_case, JSON columns
// stringified, unix SECONDS) in dependency order — entity_models ->
// listings -> state_models -> listing_state_models — plus the local
// bookkeeping to apply once the upserts succeeded.
//
// Ids are assigned for EVERY listing (the ref remap needs a complete map)
// but only the unlinked or dirty listings are pushed (`force` pushes the
// candidates regardless), plus the closure: an unlinked listing referenced
// by a pushed one is created on Krnet with its current config.

function toSec(iso) {
  const ms = Date.parse(iso ?? "");
  return ms ? Math.floor(ms / 1000) : null;
}

export default function buildNotesAppListingConfigPushRows({
  listings,
  scopeLink,
  notesAppProjectId,
  sessionUserId,
  nowSec,
  listingIds = null,
  force = false,
}) {
  const mapping = scopeLink?.listingsMapping ?? [];

  // --- id assignment (all listings)
  const assignmentByLocalId = new Map();
  const localToRemote = new Map();
  for (const l of listings) {
    const remoteId =
      l.idMaster ??
      mapping.find((m) => m.mode === "mapped" && m.localListingId === l.id)
        ?.remoteListingId ??
      nanoid();
    const entityModelId = l.notesApp?.entityModelId ?? nanoid();
    assignmentByLocalId.set(l.id, {
      listingId: l.id,
      remoteId,
      entityModelId,
      isNewListing: !l.idMaster,
      isNewEntityModel: !l.notesApp?.entityModelId,
      stateModelLsmIds: {},
    });
    localToRemote.set(l.id, remoteId);
  }

  // --- selection + ref closure
  const byId = new Map(listings.map((l) => [l.id, l]));
  const candidates = listingIds
    ? listings.filter((l) => listingIds.includes(l.id))
    : listings;
  const selected = new Set(
    candidates
      .filter((l) => force || !l.idMaster || isListingConfigDirty(l))
      .map((l) => l.id)
  );
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...selected]) {
      const l = byId.get(id);
      for (const refId of collectNotesAppListingRefs(l?.notesApp?.settings)) {
        const target = byId.get(refId);
        if (target && !target.idMaster && !selected.has(refId)) {
          selected.add(refId);
          grew = true;
        }
      }
    }
  }

  // --- rows
  const rows = {
    entityModels: [],
    listings: [],
    stateModels: [],
    listingStateModels: [],
  };
  const assignments = [];
  const mappingEntries = [];

  for (const l of listings) {
    if (!selected.has(l.id)) continue;
    const a = assignmentByLocalId.get(l.id);
    const notesApp = l.notesApp ?? {};
    const name = l.name || "Ouvrages";
    const icon = notesApp.icon ?? null;
    const color = notesApp.color ?? null;

    rows.entityModels.push({
      id: a.entityModelId,
      project_id: notesAppProjectId,
      name,
      icon,
      color,
      updated_at: nowSec,
      deleted_at: null,
      ...(a.isNewEntityModel && { created_by: sessionUserId ?? null }),
    });

    const settings = remapNotesAppListingRefs(
      parseSettings(notesApp.settings),
      localToRemote
    );
    rows.listings.push({
      id: a.remoteId,
      project_id: notesAppProjectId,
      entity_model_id: a.entityModelId,
      name,
      icon,
      color,
      settings: JSON.stringify(settings),
      updated_at: nowSec,
      deleted_at: null,
      ...(a.isNewListing && { created_by: sessionUserId ?? null }),
    });

    for (const sm of Array.isArray(notesApp.stateModels)
      ? notesApp.stateModels
      : []) {
      if (!sm?.id) continue;
      // created and deleted in Bimboxa without ever being pushed
      if (sm.isLocalOnly && sm.deletedAt) continue;
      const deletedAtSec = sm.deletedAt ? toSec(sm.deletedAt) : null;
      rows.stateModels.push({
        id: sm.id,
        entity_model_id: a.entityModelId,
        name: sm.name || "Suivi",
        states: JSON.stringify(Array.isArray(sm.states) ? sm.states : []),
        transitions: JSON.stringify(
          Array.isArray(sm.transitions) ? sm.transitions : []
        ),
        settings: JSON.stringify(
          sm.settings && typeof sm.settings === "object" ? sm.settings : {}
        ),
        updated_at: nowSec,
        deleted_at: deletedAtSec,
        ...(sm.isLocalOnly && { created_by: sessionUserId ?? null }),
      });
      const lsmId = sm.listingStateModelId ?? nanoid();
      a.stateModelLsmIds[sm.id] = lsmId;
      rows.listingStateModels.push({
        id: lsmId,
        listing_id: a.remoteId,
        state_model_id: sm.id,
        name: sm.navName || sm.name || "Suivi",
        visible: sm.visible === false ? 0 : 1,
        updated_at: nowSec,
        deleted_at: deletedAtSec,
        ...(!sm.listingStateModelId && { created_by: sessionUserId ?? null }),
      });
    }

    assignments.push(a);
    const hasMapping = mapping.some(
      (m) => m.mode === "mapped" && m.localListingId === l.id
    );
    if (!hasMapping) {
      mappingEntries.push({
        remoteListingId: a.remoteId,
        remoteListingName: name,
        localListingId: l.id,
        mode: "mapped",
      });
    }
  }

  return { rows, assignments, mappingEntries, localToRemote };
}
