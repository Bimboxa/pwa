import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import { getNotesAppClient } from "./notesAppClient";
import { getNotesAppSession } from "./notesAppAuthService";
import buildNotesAppListingConfigPushRows from "../utils/buildNotesAppListingConfigPushRows";
import { upsertMappingEntry } from "../utils/resolveNotesAppScopeLink";

// Pushes the Krnet configuration of the scope's business-object listings:
// entity_models -> listings -> state_models -> listing_state_models upserts
// (snake_case, JSON columns as strings, unix SECONDS — mobile conventions),
// then the local bookkeeping (idMaster, entityModelId, lsm ids, sync
// cursors, scope mapping entries) under withSystemWrite(withoutUndo(...)).
//
// Only the unlinked or locally-modified listings are sent (plus the
// listings they reference that do not exist on Krnet yet); `force` sends
// the given listingIds regardless — an explicit user action where Bimboxa
// wins over a Krnet edit made since the last pull.

const BATCH = 100;

async function upsertRows(client, table, rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await client
      .from(table)
      .upsert(rows.slice(i, i + BATCH), { onConflict: "id" });
    if (error) throw error;
  }
}

export default async function pushNotesAppListingsConfig({
  scope,
  listingIds = null,
  force = false,
}) {
  const link = scope?.notesApp;
  if (!link?.projectId) {
    throw new Error("Scope is not linked to a notes-app project");
  }
  const session = await getNotesAppSession();
  if (!session) {
    const error = new Error("Not signed in to notes-app");
    error.code = "NOTES_APP_NOT_SIGNED_IN";
    throw error;
  }
  const client = getNotesAppClient();

  const listings = (
    await db.listings.where("scopeId").equals(scope.id).toArray()
  ).filter((l) => !l.deletedAt && l.entityModelKey === "businessObject");

  const nowSec = Math.floor(Date.now() / 1000);
  const { rows, assignments, mappingEntries } =
    buildNotesAppListingConfigPushRows({
      listings,
      scopeLink: link,
      notesAppProjectId: link.projectId,
      sessionUserId: session.user?.id ?? null,
      nowSec,
      listingIds,
      force,
    });

  if (assignments.length === 0) {
    return { counts: { listings: 0, stateModels: 0 } };
  }

  // --- remote writes, parents first (project-scoped RLS on the children)
  await upsertRows(client, "entity_models", rows.entityModels);
  await upsertRows(client, "listings", rows.listings);
  await upsertRows(client, "state_models", rows.stateModels);
  await upsertRows(client, "listing_state_models", rows.listingStateModels);

  // --- local bookkeeping (system write: not a user edit)
  const listingById = new Map(listings.map((l) => [l.id, l]));
  await withSystemWrite(() =>
    withoutUndo(() =>
      db.transaction("rw", [db.listings, db.scopes], async () => {
        for (const a of assignments) {
          const l = listingById.get(a.listingId);
          const notesApp = l?.notesApp ?? {};
          const stateModels = (notesApp.stateModels ?? [])
            // created and deleted locally without ever being pushed
            .filter((sm) => !(sm.isLocalOnly && sm.deletedAt))
            .map((sm) => {
              const rest = { ...sm };
              delete rest.isLocalOnly;
              return {
                ...rest,
                listingStateModelId:
                  a.stateModelLsmIds[sm.id] ?? sm.listingStateModelId ?? null,
                updatedAt: nowSec * 1000,
              };
            });
          await db.listings.update(a.listingId, {
            idMaster: a.remoteId,
            remoteSource: "notesApp",
            notesApp: {
              ...notesApp,
              settings: notesApp.settings ?? {},
              stateModels,
              entityModelId: a.entityModelId,
              remoteUpdatedAt: nowSec * 1000,
              localUpdatedAt: null,
            },
          });
        }
        if (mappingEntries.length) {
          const fresh = await db.scopes.get(scope.id);
          const currentLink = fresh?.notesApp ?? link;
          let listingsMapping = currentLink.listingsMapping ?? [];
          for (const entry of mappingEntries) {
            listingsMapping = upsertMappingEntry(listingsMapping, entry);
          }
          await db.scopes.update(scope.id, {
            notesApp: { ...currentLink, listingsMapping },
          });
        }
      })
    )
  );

  return {
    counts: {
      listings: assignments.length,
      stateModels: rows.stateModels.length,
    },
  };
}
