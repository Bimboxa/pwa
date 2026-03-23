import { createSlice } from "@reduxjs/toolkit";

// --- localStorage helpers ---

const LS_PREFIX = "syncedVersion_";

function getSyncedVersionFromStorage(scopeId) {
  if (!scopeId) return null;
  const raw = localStorage.getItem(LS_PREFIX + scopeId);
  return raw ? Number(raw) : null;
}

function setSyncedVersionToStorage(scopeId, version) {
  if (!scopeId || version == null) return;
  localStorage.setItem(LS_PREFIX + scopeId, String(version));
}

// --- Slice ---

const remoteScopeConfigurationsInitialState = {
  lastRemoteConfiguration: null,
  lastSyncedRemoteConfigurationVersion: null,
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
  },
});

export const {
  setLastRemoteConfiguration,
  setLastSyncedRemoteConfigurationVersion,
  restoreSyncedVersionFromStorage,
} = remoteScopeConfigurationsSlice.actions;

// Middleware to persist synced version to localStorage
export const syncedVersionPersistMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  if (action.type === setLastSyncedRemoteConfigurationVersion.type) {
    const scopeId = store.getState().scopes?.selectedScopeId;
    setSyncedVersionToStorage(scopeId, action.payload);
  }
  return result;
};

export default remoteScopeConfigurationsSlice.reducer;
