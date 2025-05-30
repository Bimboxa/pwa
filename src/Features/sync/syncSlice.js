import {createSlice} from "@reduxjs/toolkit";

const syncInitialState = {
  //
  disableRemoteContainer: true, // disable sync
  autoSyncMacro: false, // Macro = forceLocalToRemote for Project / Scope / Listing creation.
  //
  isSyncing: false,
  openPanelSync: false,
  //
  remoteContainer: null,

  // remote container account

  rcUserAccount: null, // used to getDropbox root_namespace_id

  // remoteProjectContainer
  remoteProjectsContainers: [],
  selectedRemoteProjectsContainer: null,

  isConnectingToRemoteProjectContainer: true,

  remoteProjectContainerProps: {},
  remoteProjectContainerPropsUpdatedAt: null,

  // syncFiles

  syncFiles: [], // [path,updatedAt]

  // syncTasks

  preparingSyncTasks: false,
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
    setPreparingSyncTasks: (state, action) => {
      state.preparingSyncTasks = action.payload;
    },

    setSyncTasks: (state, action) => {
      const newTasks = action.payload;
      console.log("[STATE] setSyncTasks", newTasks);
      state.syncTasks = newTasks;
    },
    updateSyncTaskStatus: (state, action) => {
      const {id, status} = action.payload;
      const task = state.syncTasks.find((t) => t.id === id);
      if (task) task.status = status;
    },
    clearSyncTasks: (state) => {
      state.syncTasks = [];
    },
    setRcUserAccount: (state, action) => {
      state.rcUserAccount = action.payload;
    },
  },
});

export const {
  //
  setRemoteContainer,
  triggerRemoteProjectContainerPropsUpdate,
  setOpenPanelSync,
  setRemoteProjectsContainers,
  setIsSyncing,
  setSelectedRemoteProjectsContainer,
  setSyncFiles,
  //
  setPreparingSyncTasks,
  setSyncTasks,
  updateSyncTaskStatus,
  clearSyncTasks,
  //
  setRcUserAccount,
} = syncSlice.actions;

export default syncSlice.reducer;
