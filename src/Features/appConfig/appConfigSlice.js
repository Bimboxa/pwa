import { createSlice } from "@reduxjs/toolkit";

const appConfigSlice = createSlice({
  name: "appConfig",
  initialState: {
    appVersion: "1.3.34",
    configCode: null, // updated by useInitAppConfig
    newVersionAvailable: null, // { version, description } | null
    newVersionDialogOpen: false,
    value: null,
    openAppConfig: false,
    forceUpdateAt: null,
    useDefault: false, // use default config
    disable3D: false, // disable 3D rendering (perf testing)
    // device preference: full scope creation flow (card selector) vs the
    // compact name + configuration dialog (default)
    configurationsManagement: false,
    satelliteCaptureMode: "MERCATOR", // "MERCATOR" | "LAMBERT_CC" (see satelliteMap/utils/satelliteCaptureModes)
    // device preference: module a scope lands on when opened from the
    // dashboard (see useLandingViewerModuleOnScopeOpen)
    defaultModuleKey: "MAP",
    // device preference: Chat server connection { mode, baseUrl } overriding
    // the org yaml defaults (null = org defaults). Never holds credentials.
    chatConnection: null,
  },
  reducers: {
    setConfigCode: (state, action) => {
      state.configCode = action.payload;
    },
    setAppConfig: (state, action) => {
      state.value = action.payload;
    },
    setOpenAppConfig: (state, action) => {
      state.openAppConfig = action.payload;
    },
    setNewVersionAvailable: (state, action) => {
      state.newVersionAvailable = action.payload;
    },
    setNewVersionDialogOpen: (state, action) => {
      state.newVersionDialogOpen = action.payload;
    },
    forceUpdate: (state) => {
      state.forceUpdateAt = Date.now();
    },
    setUseDefault: (state, action) => {
      state.useDefault = action.payload;
      state.forceUpdateAt = Date.now();
    },
    setEnableMapEditorLegacy: (state, action) => {
      state.enableMapEditorLegacy = action.payload;
    },
    setDisable3D: (state, action) => {
      state.disable3D = action.payload;
    },
    setConfigurationsManagement: (state, action) => {
      state.configurationsManagement = action.payload;
    },
    setSatelliteCaptureMode: (state, action) => {
      state.satelliteCaptureMode = action.payload;
    },
    setDefaultModuleKey: (state, action) => {
      state.defaultModuleKey = action.payload;
    },
    setChatConnection: (state, action) => {
      state.chatConnection = action.payload;
    },
  },
});

export const {
  setConfigCode,
  setAppConfig,
  setOpenAppConfig,
  setNewVersionAvailable,
  setNewVersionDialogOpen,
  forceUpdate,
  setUseDefault,
  setEnableMapEditorLegacy,
  setDisable3D,
  setConfigurationsManagement,
  setSatelliteCaptureMode,
  setDefaultModuleKey,
  setChatConnection,
} = appConfigSlice.actions;
export default appConfigSlice.reducer;
