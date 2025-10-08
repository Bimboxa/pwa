import { createSlice } from "@reduxjs/toolkit";

const appConfigSlice = createSlice({
  name: "appConfig",
  initialState: {
    appVersion: "1.0.11",
    configCode: "edx",
    newVersionAvailable: false,
    value: null,
    openAppConfig: false,
    forceUpdateAt: null,
    useDefault: false, // use default config
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
  },
});

export const {
  setConfigCode,
  setAppConfig,
  setOpenAppConfig,
  setNewVersionAvailable,
  forceUpdate,
  setUseDefault,
} = appConfigSlice.actions;
export default appConfigSlice.reducer;
