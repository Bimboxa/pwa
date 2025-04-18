import {createSlice} from "@reduxjs/toolkit";

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

  // syncTasks

  syncTasks: [], // {filePath, status, error}
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
    // syncTasks

    setSyncTasks: (state, action) => {
      const newTasks = action.payload;
      const existingPaths = new Set(state.syncTasks.map((t) => t.filePath));
      state.syncTasks.push(
        ...newTasks.filter((t) => !existingPaths.has(t.filePath))
      );
    },
    updateSyncTaskStatus: (state, action) => {
      const {filePath, status} = action.payload;
      const task = state.syncTasks.find((t) => t.filePath === filePath);
      if (task) task.status = status;
    },
    clearSyncTasks: (state) => {
      state.syncTasks = [];
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
  setSyncTasks,
  updateSyncTaskStatus,
  clearSyncTasks,
  //
} = syncSlice.actions;

export default syncSlice.reducer;
