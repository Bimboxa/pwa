import {createSlice} from "@reduxjs/toolkit";

const appConfigSlice = createSlice({
  name: "appConfig",
  initialState: {
    appVersion: "0.9.2",
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
  },
});

export const {setAppConfig, setOpenAppConfig} = appConfigSlice.actions;
export default appConfigSlice.reducer;
