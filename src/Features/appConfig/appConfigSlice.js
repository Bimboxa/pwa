import {createSlice} from "@reduxjs/toolkit";

const appConfigSlice = createSlice({
  name: "appConfig",
  initialState: {
    appVersion: "0.12.1",
    newVersionAvailable: false,
    value: null,
    openAppConfig: false,
    forceUpdateAt: null,
    useDefault: false,
  },
  reducers: {
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
  setAppConfig,
  setOpenAppConfig,
  setNewVersionAvailable,
  forceUpdate,
  setUseDefault,
} = appConfigSlice.actions;
export default appConfigSlice.reducer;
