import {createSlice} from "@reduxjs/toolkit";

const appConfigSlice = createSlice({
  name: "appConfig",
  initialState: {
    appVersion: "0.9.9",
    newVersionAvailable: false,
    value: null,
    openAppConfig: false,
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
  },
});

export const {setAppConfig, setOpenAppConfig, setNewVersionAvailable} =
  appConfigSlice.actions;
export default appConfigSlice.reducer;
