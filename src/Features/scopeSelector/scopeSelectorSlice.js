import {createSlice} from "@reduxjs/toolkit";

const scopeSelectorInitialState = {
  open: false,
  page: "PROJECT_AND_SCOPE",
  remoteProjectsContainer: null,
  //
  project: null,
  scope: null,
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
  },
});

export const {
  setOpen,
  setPage,
  setRemoteProjectsContainer,
  setProject,
  setScope,
  //
} = scopeSelectorSlice.actions;

export default scopeSelectorSlice.reducer;
