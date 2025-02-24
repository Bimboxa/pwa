import {createSlice} from "@reduxjs/toolkit";

const layoutInitialState = {
  //
  deviceType: null, // "MOBILE" | "DESKTOP"
};

export const layoutSlice = createSlice({
  name: "layout",
  initialState: layoutInitialState,
  reducers: {
    setDeviceType: (state, action) => {
      state.deviceType = action.payload;
    },
  },
});

export const {
  setDeviceType,
  //
} = layoutSlice.actions;

export default layoutSlice.reducer;
