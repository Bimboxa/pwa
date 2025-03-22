import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";

import fetchFoldersService from "./services/fetchFoldersService";

export const fetchProjectsFolders = createAsyncThunk(
  "dropbox/fetchProjectsFolders",
  fetchFoldersService
);

const dropboxInitialState = {
  //
  accessTokenDropbox: null,
  //
  projectsFolderId: null,
  projectsFoldersMap: {},
  //
  selectedProjectFolderId: null,
};

export const dropboxSlice = createSlice({
  name: "dropbox",
  initialState: dropboxInitialState,
  reducers: {
    setAccessTokenDropbox: (state, action) => {
      state.accessTokenDropbox = action.payload;
    },
    setProjectsFolderId: (state, action) => {
      state.projectsFolderId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchProjectsFolders.fulfilled, (state, action) => {
      const folders = action.payload;
      folders.forEach((folder) => {
        state.projectsFoldersMap[folder.id] = folder;
      });
    });
  },
});

export const {setAccessTokenDropbox, setProjectsFolderId} =
  dropboxSlice.actions;

export default dropboxSlice.reducer;
