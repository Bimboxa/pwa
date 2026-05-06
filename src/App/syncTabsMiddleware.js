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

const BASEMAP_SELECT_ACTION = "mapEditors/setSelectedMainBaseMapId";

function isSynced(type) {
  if (!type) return false;
  if (SYNCED_ACTION_TYPES.has(type)) return true;
  return SYNCED_PREFIXES.some((p) => type.startsWith(p));
}

function buildContextBundle(state) {
  return {
    selectedProjectId: state.projects?.selectedProjectId ?? null,
    selectedScopeId: state.scopes?.selectedScopeId ?? null,
    selectedBaseMapViewId: state.baseMapViews?.selectedBaseMapViewId ?? null,
    selectedBaseMapViewIdInEditor:
      state.baseMapViews?.selectedBaseMapViewIdInEditor ?? null,
  };
}

const channel = new BroadcastChannel("redux-sync");

export const syncTabsMiddleware = (storeApi) => (next) => (action) => {
  const result = next(action);

  if (
    isSynced(action.type) &&
    !action.meta?.fromBroadcast &&
    isEffectivelyCoupled(storeApi.getState(), getCurrentPathname())
  ) {
    let payload = action;
    if (action.type === BASEMAP_SELECT_ACTION) {
      payload = {
        ...action,
        meta: {
          ...action.meta,
          contextBundle: buildContextBundle(storeApi.getState()),
        },
      };
    }
    channel.postMessage(payload);
  }

  return result;
};

export function initSyncTabsListener(store) {
  channel.onmessage = (event) => {
    const action = event.data;
    if (!action || !isSynced(action.type)) return;
    // Receive gate: only the /dashboard exclusion. The receiver applies
    // broadcasts even if its own switch is off — mutual exclusion ensures
    // only one tab is broadcasting, and "passive" tabs follow it. The
    // user can opt out by going to /dashboard.
    if (getCurrentPathname().startsWith("/dashboard")) return;

    const meta = { fromBroadcast: true };

    if (action.type === BASEMAP_SELECT_ACTION && action.meta?.contextBundle) {
      const ctx = action.meta.contextBundle;
      if (ctx.selectedProjectId !== undefined) {
        store.dispatch({
          type: "projects/setSelectedProjectId",
          payload: ctx.selectedProjectId,
          meta,
        });
      }
      if (ctx.selectedScopeId !== undefined) {
        store.dispatch({
          type: "scopes/setSelectedScopeId",
          payload: ctx.selectedScopeId,
          meta,
        });
      }
    }

    store.dispatch({ ...action, meta: { ...action.meta, fromBroadcast: true } });

    if (action.type === BASEMAP_SELECT_ACTION && action.meta?.contextBundle) {
      const ctx = action.meta.contextBundle;
      if (ctx.selectedBaseMapViewId !== undefined) {
        store.dispatch({
          type: "baseMapViews/setSelectedBaseMapViewId",
          payload: ctx.selectedBaseMapViewId,
          meta,
        });
      }
      if (ctx.selectedBaseMapViewIdInEditor !== undefined) {
        store.dispatch({
          type: "baseMapViews/setSelectedBaseMapViewIdInEditor",
          payload: ctx.selectedBaseMapViewIdInEditor,
          meta,
        });
      }
    }
  };
}

export default syncTabsMiddleware;
