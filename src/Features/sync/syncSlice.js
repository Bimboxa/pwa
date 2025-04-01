import {createSlice} from "@reduxjs/toolkit";
import {setRemoteProjectsContainer} from "Features/scopeSelector/scopeSelectorSlice";

const syncInitialState = {
  //
  isSyncing: false,
  openPanelSync: false,
  //
  // remoteProjectContainer
  remoteProjectsContainers: [],
  selectedRemoteProjectsContainer: null,

  isConnectingToRemoteProjectContainer: true,

  remoteProjectContainerProps: {},
  remoteProjectContainerPropsUpdatedAt: null,
};

export const syncSlice = createSlice({
  name: "sync",
  initialState: syncInitialState,
  reducers: {
    setOpenPanelSync: (state, action) => {
      state.openPanelSync = action.payload;
    },
    setRemoteProjectsContainers: (state, action) => {
      state.remoteProjectsContainers = action.payload;
    },
    triggerRemoteProjectContainerPropsUpdate: (state, action) => {
      console.log("[STATE] update containerProps");
      state.remoteProjectContainerPropsUpdatedAt = Date.now();
    },
    setSelectedRemoteProjectsContainer: (state, action) => {
      state.selectedRemoteProjectsContainer = action.payload;
    },
    //
    setIsSyncing: (state, action) => {
      state.isSyncing = action.payload;
    },
  },
});

export const {
  triggerRemoteProjectContainerPropsUpdate,
  setOpenPanelSync,
  setRemoteProjectsContainers,
  setIsSyncing,
  setSelectedRemoteProjectsContainer,
  //
} = syncSlice.actions;

export default syncSlice.reducer;
