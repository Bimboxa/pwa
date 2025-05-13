import {createSlice} from "@reduxjs/toolkit";

const scopeSelectorInitialState = {
  open: false,
  page: "PROJECT_AND_SCOPE",
  remoteProjectsContainer: null,
  //
  project: null,
  scope: null,
  //
  showScopePresetSelector: false,
  //
  remoteFolder: null,
  //
  remoteProjectContainer: null, // {service,metadata}
  remoteOpenedProjects: null, // [{clientId,label,clientRef,createdAt}]
  remoteProject: null, // selected remote project
};

export const scopeSelectorSlice = createSlice({
  name: "scopeSelector",
  initialState: scopeSelectorInitialState,
  reducers: {
    setOpen: (state, action) => {
      state.open = action.payload;
    },
    setPage: (state, action) => {
      state.page = action.payload;
    },
    setRemoteProjectsContainer: (state, action) => {
      state.remoteProjectsContainer = action.payload;
    },
    setProject: (state, action) => {
      state.project = action.payload;
    },
    setScope: (state, action) => {
      state.scope = action.payload;
    },
    setRemoteFolder: (state, action) => {
      state.remoteFolder = action.payload;
    },
    setRemoteOpenedProjects: (state, action) => {
      state.remoteOpenedProjects = action.payload;
    },
    setRemoteProject: (state, action) => {
      state.remoteProject = action.payload;
    },
    setRemoteProjectContainer: (state, action) => {
      state.remoteProjectContainer = action.payload;
    },
    setShowScopePresetSelector: (state, action) => {
      state.showScopePresetSelector = action.payload;
    },
  },
});

export const {
  setOpen,
  setPage,
  setRemoteProjectsContainer,
  setProject,
  setScope,
  setRemoteFolder,
  setRemoteProjectContainer,
  setRemoteOpenedProjects,
  setRemoteProject,
  setShowScopePresetSelector,
  //
} = scopeSelectorSlice.actions;

export default scopeSelectorSlice.reducer;
