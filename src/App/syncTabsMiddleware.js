import {
  isEffectivelyCoupled,
  getCurrentPathname,
} from "Features/layout/utils/isEffectivelyCoupled";

const SYNCED_ACTION_TYPES = new Set([
  "projects/setSelectedProjectId",
  "scopes/setSelectedScopeId",
  "mapEditors/setSelectedMainBaseMapId",
  "baseMapViews/setSelectedBaseMapViewId",
  "baseMapViews/setSelectedBaseMapViewIdInEditor",
]);

const SYNCED_PREFIXES = ["selection/"];

function isSynced(type) {
  if (!type) return false;
  if (SYNCED_ACTION_TYPES.has(type)) return true;
  return SYNCED_PREFIXES.some((p) => type.startsWith(p));
}

const channel = new BroadcastChannel("redux-sync");

export const syncTabsMiddleware = (storeApi) => (next) => (action) => {
  const result = next(action);

  if (
    isSynced(action.type) &&
    !action.meta?.fromBroadcast &&
    isEffectivelyCoupled(storeApi.getState(), getCurrentPathname())
  ) {
    channel.postMessage(action);
  }

  return result;
};

export function initSyncTabsListener(store) {
  channel.onmessage = (event) => {
    const action = event.data;
    if (!action || !isSynced(action.type)) return;
    if (!isEffectivelyCoupled(store.getState(), getCurrentPathname())) return;
    store.dispatch({ ...action, meta: { ...action.meta, fromBroadcast: true } });
  };
}

export default syncTabsMiddleware;
