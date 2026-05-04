import store from "App/store";

import {
  setLastLocalChangeAt,
  setStaleChangesDialogOpen,
  setRemoteNewerDialogOpen,
  selectIsLocallyDirty,
} from "../remoteScopeConfigurationsSlice";

import { getPullHandle } from "./pullHandle";

const STALE_THRESHOLD_MS = 30 * 60 * 1000;
const DEBOUNCE_MS = 500;
const DIALOG_DISMISS_COOLDOWN_MS = 5 * 60 * 1000;

let _debounceTimer = null;
let _lastDismissedAt = 0;

export function notifyLocalChange() {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    void evaluateAndOpenSyncDialog({ isUserTriggered: false });
  }, DEBOUNCE_MS);
}

export function notifyDialogDismissed() {
  _lastDismissedAt = Date.now();
}

export async function evaluateAndOpenSyncDialog({
  isUserTriggered = false,
} = {}) {
  const stateBefore = store.getState().remoteScopeConfigurations;
  const previousLastLocalChangeAt = stateBefore.lastLocalChangeAt;
  const wasDirty = selectIsLocallyDirty(store.getState());

  const now = Date.now();
  store.dispatch(setLastLocalChangeAt(now));

  if (isUserTriggered) return;

  const stale =
    previousLastLocalChangeAt != null &&
    now - previousLastLocalChangeAt > STALE_THRESHOLD_MS;

  if (!stale || !wasDirty) return;

  if (now - _lastDismissedAt < DIALOG_DISMISS_COOLDOWN_MS) return;

  const stateNow = store.getState().remoteScopeConfigurations;
  if (stateNow.staleChangesDialogOpen || stateNow.remoteNewerDialogOpen) return;

  const pull = getPullHandle();
  if (pull) {
    try {
      await pull();
    } catch (e) {
      console.error("[localChangeTracker] pull error", e);
    }
  }

  const after = store.getState().remoteScopeConfigurations;
  const remoteV = after.lastRemoteConfiguration?.version;
  const syncedV = after.lastSyncedRemoteConfigurationVersion;

  if (remoteV != null && syncedV != null && remoteV > syncedV) {
    store.dispatch(setRemoteNewerDialogOpen(true));
  } else {
    store.dispatch(setStaleChangesDialogOpen(true));
  }
}
