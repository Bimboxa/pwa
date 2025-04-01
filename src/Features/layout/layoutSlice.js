import {createSlice} from "@reduxjs/toolkit";
import {setOpen} from "Features/listPanel/listPanelSlice";

const layoutInitialState = {
  //
  deviceType: null, // "MOBILE" | "DESKTOP"
  //
  topBarHeight: 48,
  //
  viewModeInMobile: "LIST", // "MAP" | "LIST"
  //
  openChat: false,
  chatWidth: 400,
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
    //
    setOpenChat: (state, action) => {
      state.openChat = action.payload;
    },
  },
});

export const {
  setDeviceType,
  //
  setViewModeInMobile,
  //
  setOpenChat,
} = layoutSlice.actions;

export default layoutSlice.reducer;
