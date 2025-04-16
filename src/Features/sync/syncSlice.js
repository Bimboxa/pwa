import {createSlice} from "@reduxjs/toolkit";
import {
  setOpen,
  setRemoteProjectsContainer,
} from "Features/scopeSelector/scopeSelectorSlice";

const syncInitialState = {
  //
  isSyncing: false,
  openPanelSync: false,
  //
  remoteContainer: null,
  //
  // remoteProjectContainer
  remoteProjectsContainers: [],
  selectedRemoteProjectsContainer: null,

  isConnectingToRemoteProjectContainer: true,

  remoteProjectContainerProps: {},
  remoteProjectContainerPropsUpdatedAt: null,

  // syncFiles

  syncFiles: [], // [path,updatedAt]
};

export const syncSlice = createSlice({
  name: "sync",
  initialState: syncInitialState,
  reducers: {
    setRemoteContainer: (state, action) => {
      console.log("[STATE] setRemoteContainer", action.payload?.service);
      state.remoteContainer = action.payload;
    },
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
    //
    setSyncFiles: (state, action) => {
      state.syncFiles = action.payload;
    },
  },
});

export const {
  setRemoteContainer,
  triggerRemoteProjectContainerPropsUpdate,
  setOpenPanelSync,
  setRemoteProjectsContainers,
  setIsSyncing,
  setSelectedRemoteProjectsContainer,
  setSyncFiles,
  //
} = syncSlice.actions;

export default syncSlice.reducer;
