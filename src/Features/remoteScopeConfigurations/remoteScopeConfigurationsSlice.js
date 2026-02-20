import { createSlice } from "@reduxjs/toolkit";

const remoteScopeConfigurationsInitialState = {
  // lastRemoteConfiguration: {
  //   version: 3,
  //   createdBy: { trigram: "SIH" },
  //   createdAt: '2026-02-05T07:35:34.134Z',
  //   fileSize: 25 * 1024 * 1024,
  // },
  lastRemoteConfiguration: null,
  lastSyncedRemoteConfigurationVersion: 1,
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

  },
});

export const { setLastRemoteConfiguration, setLastSyncedRemoteConfigurationVersion } = remoteScopeConfigurationsSlice.actions;

export default remoteScopeConfigurationsSlice.reducer;
