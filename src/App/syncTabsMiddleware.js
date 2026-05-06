import {
  shouldEmit,
  shouldReceive,
  getCurrentPathname,
} from "Features/layout/utils/isEffectivelyCoupled";

const SYNCED_ACTION_TYPES = new Set([
  "projects/setSelectedProjectId",
  "scopes/setSelectedScopeId",
  "mapEditors/setSelectedMainBaseMapId",
  "baseMapViews/setSelectedBaseMapViewId",
  "baseMapViews/setSelectedBaseMapViewIdInEditor",
  // Visibility options consumed by useAnnotationsV2 — keep 2D and 3D
  // views consistent between tabs.
  "listings/setHiddenListingsIds",
  "listings/hideListingId",
  "listings/showListingId",
  "layers/toggleLayerVisibility",
  "layers/toggleShowAnnotationsWithoutLayer",
  "layers/triggerLayersUpdate",
  "popperMapListings/setSoloMode",
  "popperMapListings/setSoloVisibleTemplateIds",
  "popperMapListings/setSoloListingId",
]);

const SYNCED_PREFIXES = ["selection/"];

const BASEMAP_SELECT_ACTION = "mapEditors/setSelectedMainBaseMapId";

// Project/scope clears (e.g. when the leader navigates back to /dashboard)
// must NOT cross the BroadcastChannel — that would yank the follower out of
// its current context. Selecting a real project/scope still propagates.
const PROJECT_SCOPE_CLEAR_ACTIONS = new Set([
  "projects/setSelectedProjectId",
  "scopes/setSelectedScopeId",
]);

function isSynced(type) {
  if (!type) return false;
  if (SYNCED_ACTION_TYPES.has(type)) return true;
  return SYNCED_PREFIXES.some((p) => type.startsWith(p));
}

function isProjectScopeClear(action) {
  if (!PROJECT_SCOPE_CLEAR_ACTIONS.has(action.type)) return false;
  return action.payload == null;
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
    !isProjectScopeClear(action) &&
    shouldEmit(storeApi.getState())
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
    if (!shouldReceive(store.getState(), getCurrentPathname())) return;

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
