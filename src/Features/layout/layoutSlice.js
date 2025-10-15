import { bottomNavigationActionClasses } from "@mui/material";
import { createSlice } from "@reduxjs/toolkit";

const layoutInitialState = {
  //
  deviceType: null, // "MOBILE" | "DESKTOP"
  //
  windowHeight: null,
  //
  topBarHeight: 48,
  bottomBarHeight: 56,
  bottomBarHeightDesktop: 42,
  //
  viewModeInMobile: "LIST", // "MAP" | "LIST"
  //
  openChat: false,
  chatWidth: 400,
  //
  toaster: {}, // {triggeredAt,isError,message}
  //
  isFullScreen: false,
};

export const layoutSlice = createSlice({
  name: "layout",
  initialState: layoutInitialState,
  reducers: {
    setWindowHeight: (state, action) => {
      state.windowHeight = action.payload;
    },
    setBottomBarHeight: (state, action) => {
      state.bottomBarHeight = action.payload;
    },
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
    //
    setToaster: (state, action) => {
      const toaster = action.payload;
      state.toaster = {
        message: toaster.message,
        isError: toaster.isError,
        triggeredAt: Date.now(),
      };
    },
    setIsFullScreen: (state, action) => {
      state.isFullScreen = action.payload;
    },
  },
});

export const {
  setWindowHeight,
  //
  setBottomBarHeight,
  //
  setDeviceType,
  //
  setViewModeInMobile,
  //
  setOpenChat,
  //
  setToaster,
  //
  setIsFullScreen,
} = layoutSlice.actions;

export default layoutSlice.reducer;
