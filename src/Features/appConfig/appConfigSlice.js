import { createSlice } from "@reduxjs/toolkit";

const appConfigSlice = createSlice({
  name: "appConfig",
  initialState: {
    appVersion: "1.3.9",
    configCode: "edx",
    newVersionAvailable: false,
    value: null,
    openAppConfig: false,
    forceUpdateAt: null,
    useDefault: false, // use default config
    //enableMapEditorLegacy: true
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
  },
});

export const {
  setConfigCode,
  setAppConfig,
  setOpenAppConfig,
  setNewVersionAvailable,
  forceUpdate,
  setUseDefault,
  setEnableMapEditorLegacy
} = appConfigSlice.actions;
export default appConfigSlice.reducer;
