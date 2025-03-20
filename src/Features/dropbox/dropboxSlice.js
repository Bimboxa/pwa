import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";

import fetchFoldersService from "./services/fetchFoldersService";

export const fetchProjectsFolders = createAsyncThunk(
  "dropbox/fetchProjectsFolders",
  fetchFoldersService
);

const dropboxInitialState = {
  projectsFolderId: null,
  projectsFoldersMap: new Map(),
  //
  selectedProjectFolderId: null,
};

export const dropboxSlice = createSlice({
  name: "dropbox",
  initialState: dropboxInitialState,
  reducers: {
    setProjectsFolderId: (state, action) => {
      state.projectsFolderId = action.payload;
    },
    setProjectsFoldersMap: (state, action) => {
      const folders = action.payload;
      console.log("[STATE] [dropbox] projectsFolders", folders);
      folders.forEach((folder) => {
        state.projectsFoldersMap.set(folder.id, folder);
      });
    },
  },
});

export const {setProjectsFolderId, setProjectsFoldersMap} =
  dropboxSlice.actions;

export default dropboxSlice.reducer;
