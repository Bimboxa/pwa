// services/dexieSyncService.js
import {liveQuery} from "dexie";
import db from "../App/db/db";
import store from "../App/store";

import {setProjectsById} from "../Features/projects/projectsSlice";
import {
  setScopesById,
  setRelsScopeItemByScopeId,
} from "../Features/scopes/scopesSlice";
import {setListingsById} from "../Features/listings/listingsSlice";
import {setEntitiesById} from "../Features/entities/entitiesSlice";

const syncConfigs = [
  {
    table: "projects",
    query: () => db.projects.toArray(),
    action: setProjectsById,
  },
  {
    table: "scopes",
    query: () => db.scopes.toArray(),
    action: setScopesById,
  },
  {
    table: "listings",
    query: () => db.listings.toArray(),
    action: setListingsById,
  },
  {
    table: "relsScopeItem",
    query: () => db.relsScopeItem.toArray(),
    action: setRelsScopeItemByScopeId,
  },
  {
    table: "entities",
    query: () => db.entities.toArray(),
    action: setEntitiesById,
  },
];

const subscriptions = {};

export function startDexieSync() {
  syncConfigs.forEach(({table, query, action}) => {
    if (subscriptions[table]) return; // already syncing

    const observable = liveQuery(query);
    subscriptions[table] = observable.subscribe({
      next: (data) => {
        store.dispatch(action(data));
      },
      error: (err) => {
        console.error(`[Dexie Sync] Error in table "${table}":`, err);
      },
    });
  });
}

export function stopDexieSync() {
  Object.values(subscriptions).forEach((sub) => sub.unsubscribe());
  Object.keys(subscriptions).forEach((key) => delete subscriptions[key]);
}
