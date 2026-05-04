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
  lastRemoteConfiguration: null,
  lastSyncedRemoteConfigurationVersion: null,
  lastLocalChangeAt: null,
  lastSyncAt: null,
  staleChangesDialogOpen: false,
  remoteNewerDialogOpen: false,
  dialogSyncOpen: false,
};

export const remoteScopeConfigurationsSlice = createSlice({
  name: "remoteScopeConfigurations",
  initialState: remoteScopeConfigurationsInitialState,
  reducers: {
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
  },
});

export const {
  setLastRemoteConfiguration,
  setLastSyncedRemoteConfigurationVersion,
  restoreSyncedVersionFromStorage,
  setLastLocalChangeAt,
  setLastSyncAt,
  restoreScopeSyncStateFromStorage,
  setStaleChangesDialogOpen,
  setRemoteNewerDialogOpen,
  setDialogSyncOpen,
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
