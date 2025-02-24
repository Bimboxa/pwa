import {createSlice} from "@reduxjs/toolkit";

const settingsInitialState = {
  //
  servicesConfig: null,
  servicesConfigQrCode: null,
  //
};

export const settingsSlice = createSlice({
  name: "settings",
  initialState: settingsInitialState,
  reducers: {
    setServicesConfig: (state, action) => {
      state.servicesConfig = action.payload;
    },
    setServicesConfigQrCode: (state, action) => {
      state.servicesConfigQrCode = action.payload;
    },
  },
});

export const {
  setServicesConfig,
  setServicesConfigQrCode,
  //
} = settingsSlice.actions;

export default settingsSlice.reducer;
