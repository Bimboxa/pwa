import { createSlice } from "@reduxjs/toolkit";

// --- localStorage helpers ---

const SYNCED_VERSION_PREFIX = "syncedVersion_";
const LAST_LOCAL_CHANGE_PREFIX = "lastLocalChangeAt_";
const LAST_SYNC_PREFIX = "lastSyncAt_";

function getNumberFromStorage(key) {
  const raw = localStorage.getItem(key);
  return raw ? Number(raw) : null;
}

function setNumberToStorage(key, value) {
  if (value == null) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, String(value));
}

function getSyncedVersionFromStorage(scopeId) {
  if (!scopeId) return null;
  return getNumberFromStorage(SYNCED_VERSION_PREFIX + scopeId);
}

function setSyncedVersionToStorage(scopeId, version) {
  if (!scopeId || version == null) return;
  setNumberToStorage(SYNCED_VERSION_PREFIX + scopeId, version);
}

function getLastLocalChangeFromStorage(scopeId) {
  if (!scopeId) return null;
  return getNumberFromStorage(LAST_LOCAL_CHANGE_PREFIX + scopeId);
}

function setLastLocalChangeToStorage(scopeId, ts) {
  if (!scopeId) return;
  setNumberToStorage(LAST_LOCAL_CHANGE_PREFIX + scopeId, ts);
}

// Removes a scope's sync state keys — used when the scope's local data is
// deleted, so a later re-install starts from a clean sync state.
export function clearScopeSyncStorage(scopeId) {
  if (!scopeId) return;
  localStorage.removeItem(SYNCED_VERSION_PREFIX + scopeId);
  localStorage.removeItem(LAST_LOCAL_CHANGE_PREFIX + scopeId);
  localStorage.removeItem(LAST_SYNC_PREFIX + scopeId);
}

function getLastSyncFromStorage(scopeId) {
  if (!scopeId) return null;
  return getNumberFromStorage(LAST_SYNC_PREFIX + scopeId);
}

function setLastSyncToStorage(scopeId, ts) {
  if (!scopeId) return;
  setNumberToStorage(LAST_SYNC_PREFIX + scopeId, ts);
}

// --- Slice ---

const remoteScopeConfigurationsInitialState = {
  userConfigurations: [], // scope configurations of the connected user (ByUser)
  projectConfigurations: {}, // project idMaster => scope configurations (ByProject)
  lastRemoteConfiguration: null,
  lastSyncedRemoteConfigurationVersion: null,
  lastLocalChangeAt: null,
  lastSyncAt: null,
  staleChangesDialogOpen: false,
  remoteNewerDialogOpen: false,
  dialogSyncOpen: false,
  confirmSaveDialogOpen: false,
  pushing: false,
  saving: false, // direct save (zip + push) in flight
  savingFileSize: null, // zip size in bytes, known once the zip is generated
  pendingInitialSaveScopeId: null,
};

export const remoteScopeConfigurationsSlice = createSlice({
  name: "remoteScopeConfigurations",
  initialState: remoteScopeConfigurationsInitialState,
  reducers: {
    setUserConfigurations: (state, action) => {
      state.userConfigurations = action.payload ?? [];
    },
    setProjectConfigurations: (state, action) => {
      const { idMaster, configurations } = action.payload ?? {};
      if (!idMaster) return;
      state.projectConfigurations[String(idMaster)] = configurations ?? [];
    },
    setLastRemoteConfiguration: (state, action) => {
      state.lastRemoteConfiguration = action.payload;
    },
    setLastSyncedRemoteConfigurationVersion: (state, action) => {
      state.lastSyncedRemoteConfigurationVersion = action.payload;
    },
    restoreSyncedVersionFromStorage: (state, action) => {
      const scopeId = action.payload;
      const stored = getSyncedVersionFromStorage(scopeId);
      if (stored != null) {
        state.lastSyncedRemoteConfigurationVersion = stored;
      }
    },
    setLastLocalChangeAt: (state, action) => {
      state.lastLocalChangeAt = action.payload;
    },
    setLastSyncAt: (state, action) => {
      state.lastSyncAt = action.payload;
    },
    restoreScopeSyncStateFromStorage: (state, action) => {
      const scopeId = action.payload;
      state.lastLocalChangeAt = getLastLocalChangeFromStorage(scopeId);
      state.lastSyncAt = getLastSyncFromStorage(scopeId);
    },
    setStaleChangesDialogOpen: (state, action) => {
      state.staleChangesDialogOpen = action.payload;
    },
    setRemoteNewerDialogOpen: (state, action) => {
      state.remoteNewerDialogOpen = action.payload;
    },
    setDialogSyncOpen: (state, action) => {
      state.dialogSyncOpen = action.payload;
    },
    setConfirmSaveDialogOpen: (state, action) => {
      state.confirmSaveDialogOpen = action.payload;
    },
    setPushing: (state, action) => {
      state.pushing = Boolean(action.payload);
    },
    setSaving: (state, action) => {
      state.saving = Boolean(action.payload);
      if (!state.saving) state.savingFileSize = null;
    },
    setSavingFileSize: (state, action) => {
      state.savingFileSize = action.payload;
    },
    setPendingInitialSaveScopeId: (state, action) => {
      state.pendingInitialSaveScopeId = action.payload;
    },
  },
});

export const {
  setUserConfigurations,
  setProjectConfigurations,
  setLastRemoteConfiguration,
  setLastSyncedRemoteConfigurationVersion,
  restoreSyncedVersionFromStorage,
  setLastLocalChangeAt,
  setLastSyncAt,
  restoreScopeSyncStateFromStorage,
  setStaleChangesDialogOpen,
  setRemoteNewerDialogOpen,
  setDialogSyncOpen,
  setConfirmSaveDialogOpen,
  setPushing,
  setSaving,
  setSavingFileSize,
  setPendingInitialSaveScopeId,
} = remoteScopeConfigurationsSlice.actions;

// --- Selectors ---

export const selectIsLocallyDirty = (state) => {
  const { lastLocalChangeAt, lastSyncAt } = state.remoteScopeConfigurations;
  if (!lastLocalChangeAt) return false;
  return !lastSyncAt || lastLocalChangeAt > lastSyncAt;
};

// --- Middleware to persist sync state to localStorage ---

export const syncedVersionPersistMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  const scopeId = store.getState().scopes?.selectedScopeId;
  switch (action.type) {
    case setLastSyncedRemoteConfigurationVersion.type:
      setSyncedVersionToStorage(scopeId, action.payload);
      break;
    case setLastLocalChangeAt.type:
      setLastLocalChangeToStorage(scopeId, action.payload);
      break;
    case setLastSyncAt.type:
      setLastSyncToStorage(scopeId, action.payload);
      break;
    default:
      break;
  }
  return result;
};

export default remoteScopeConfigurationsSlice.reducer;
