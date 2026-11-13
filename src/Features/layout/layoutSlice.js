import { bottomNavigationActionClasses } from "@mui/material";
import { createSlice } from "@reduxjs/toolkit";

import {
  loadCoupledNavigationEnabled,
  storeCoupledNavigationEnabled,
} from "./services/coupledNavigationLocalStorage";

const layoutInitialState = {
  //
  deviceType: null, // "MOBILE" | "DESKTOP"
  //
  windowHeight: null,
  // Narrow window (see useAutoCompactLayout): the desktop layout only shows
  // the editor — no modules band, side panels nor floating panels, a
  // commands toolbar reduced to its small screen mode — and a bottom bar reduced to the display options.
  compactLayout: false,
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
  coupledNavigationEnabled: loadCoupledNavigationEnabled(),
};

export const layoutSlice = createSlice({
  name: "layout",
  initialState: layoutInitialState,
  reducers: {
    setWindowHeight: (state, action) => {
      state.windowHeight = action.payload;
    },
    setCompactLayout: (state, action) => {
      state.compactLayout = Boolean(action.payload);
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
        severity: toaster.severity,
        triggeredAt: Date.now(),
      };
    },
    setCoupledNavigationEnabled: (state, action) => {
      state.coupledNavigationEnabled = Boolean(action.payload);
      storeCoupledNavigationEnabled(state.coupledNavigationEnabled);
    },
  },
});

export const {
  setWindowHeight,
  setCompactLayout,
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
  setCoupledNavigationEnabled,
} = layoutSlice.actions;

export default layoutSlice.reducer;
