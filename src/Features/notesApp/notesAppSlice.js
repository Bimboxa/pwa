import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Supabase session mirror — a separate identity from the Bimboxa auth.
  session: null, // { userId, email } | null
  authStatus: "idle", // idle | loading | signedIn | error

  remoteProjects: [], // [{ projectId, projectName, role }]
  remoteProjectsStatus: "idle", // idle | loading | success | error

  remoteListingsByProjectId: {}, // { [projectId]: [{ id, name, color, ... }] }

  syncStatus: { status: "idle", step: null, message: null }, // idle | syncing | success | error
};

const notesAppSlice = createSlice({
  name: "notesApp",
  initialState,
  reducers: {
    setNotesAppSession: (state, action) => {
      state.session = action.payload ?? null;
      state.authStatus = action.payload ? "signedIn" : "idle";
    },
    setNotesAppAuthStatus: (state, action) => {
      state.authStatus = action.payload;
    },
    setNotesAppRemoteProjects: (state, action) => {
      state.remoteProjects = action.payload ?? [];
      state.remoteProjectsStatus = "success";
    },
    setNotesAppRemoteProjectsStatus: (state, action) => {
      state.remoteProjectsStatus = action.payload;
    },
    setNotesAppRemoteListings: (state, action) => {
      const { projectId, listings } = action.payload;
      state.remoteListingsByProjectId[projectId] = listings ?? [];
    },
    setNotesAppSyncStatus: (state, action) => {
      state.syncStatus = { ...state.syncStatus, ...action.payload };
    },
  },
});

export const {
  setNotesAppSession,
  setNotesAppAuthStatus,
  setNotesAppRemoteProjects,
  setNotesAppRemoteProjectsStatus,
  setNotesAppRemoteListings,
  setNotesAppSyncStatus,
} = notesAppSlice.actions;

export default notesAppSlice.reducer;
