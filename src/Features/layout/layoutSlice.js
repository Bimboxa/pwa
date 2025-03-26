import {createSlice} from "@reduxjs/toolkit";

const layoutInitialState = {
  //
  deviceType: null, // "MOBILE" | "DESKTOP"

  //
  viewModeInMobile: "LIST", // "MAP" | "LIST"
};

export const layoutSlice = createSlice({
  name: "layout",
  initialState: layoutInitialState,
  reducers: {
    setDeviceType: (state, action) => {
      state.deviceType = action.payload;
    },
    //
    setViewModeInMobile: (state, action) => {
      state.viewModeInMobile = action.payload;
    },
  },
});

export const {
  setDeviceType,
  //
  setViewModeInMobile,
} = layoutSlice.actions;

export default layoutSlice.reducer;
