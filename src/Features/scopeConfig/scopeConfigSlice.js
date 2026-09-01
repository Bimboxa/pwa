import { createSlice } from "@reduxjs/toolkit";

// Per-scope module/tool activation (db.scopeConfigs), synced into redux by
// dexieSyncService so the many consumers of useViewers / useRightPanelTools
// read it with plain useSelector instead of one liveQuery observer each.

function getRowTs(row) {
  return new Date(row?.updatedAt ?? row?.createdAt ?? 0).getTime();
}

const scopeConfigInitialState = {
  itemsByScopeId: {},
  // Gates the auto-switch guard (useEnsureEnabledModule): before the first
  // liveQuery emission the disabled lists are unknown, not empty.
  synced: false,
};

export const scopeConfigSlice = createSlice({
  name: "scopeConfig",
  initialState: scopeConfigInitialState,
  reducers: {
    setScopeConfigs: (state, action) => {
      const rows = action.payload ?? [];
      const byScopeId = {};
      rows
        .filter((row) => !row.deletedAt)
        .forEach((row) => {
          // One row per scope by convention; on an import anomaly keep the
          // newest so reads stay deterministic.
          const existing = byScopeId[row.scopeId];
          if (!existing || getRowTs(row) > getRowTs(existing)) {
            byScopeId[row.scopeId] = row;
          }
        });
      state.itemsByScopeId = byScopeId;
      state.synced = true;
    },
  },
});

export const { setScopeConfigs } = scopeConfigSlice.actions;

export default scopeConfigSlice.reducer;
