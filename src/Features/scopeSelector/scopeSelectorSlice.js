import {createSlice} from "@reduxjs/toolkit";

const scopeSelectorInitialState = {
  open: false,
  page: "PROJECT_AND_SCOPE",
  remoteProjectsContainer: null,
  //
  project: null,
  scope: null,
  //
  remoteFolder: null,
  //
  remoteProjectContainer: null, // {service,metadata}
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
    setRemoteProjectContainer: (state, action) => {
      state.remoteProjectContainer = action.payload;
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
  //
} = scopeSelectorSlice.actions;

export default scopeSelectorSlice.reducer;
