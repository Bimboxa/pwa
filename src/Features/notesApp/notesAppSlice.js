import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Supabase session mirror — a separate identity from the Bimboxa auth.
  session: null, // { userId, email } | null
  authStatus: "idle", // idle | loading | signedIn | error

  remoteProjects: [], // [{ projectId, projectName, role }]
  remoteProjectsStatus: "idle", // idle | loading | success | error

  remoteListingsByProjectId: {}, // { [projectId]: [{ id, name, color, ... }] }

  syncStatus: { status: "idle", step: null, message: null }, // idle | syncing | success | error

  // Selected tab of the business-object properties panel ("PROPS" | "FICHE"
  // | "NOTES"). In Redux so browsing from object to object keeps the tab.
  objectPropertiesTab: "PROPS",

  // Sub-view stack of the listing configuration ("Avancé" tab of the
  // business-object listing properties panel; the root CONFIG content is
  // the tab itself, only the sub-views are stacked). In Redux so the panel
  // remounts (selection changes, live queries) keep the open view. Entries:
  // { key: "FIELDS" | "FIELD" | "STATE_MODELS" | "STATE_MODEL" | "STATE"
  //   | "AUTO_CODE", fieldId?, stateModelId?, stateId? }
  listingConfigView: { listingId: null, stack: [] },
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
    setNotesAppObjectPropertiesTab: (state, action) => {
      state.objectPropertiesTab = action.payload;
    },
    pushListingConfigView: (state, action) => {
      const { listingId, view } = action.payload;
      if (state.listingConfigView.listingId !== listingId) {
        state.listingConfigView = { listingId, stack: [] };
      }
      state.listingConfigView.stack.push(view);
    },
    popListingConfigView: (state) => {
      state.listingConfigView.stack.pop();
    },
    resetListingConfigView: (state) => {
      state.listingConfigView = { listingId: null, stack: [] };
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
  setNotesAppObjectPropertiesTab,
  pushListingConfigView,
  popListingConfigView,
  resetListingConfigView,
} = notesAppSlice.actions;

export default notesAppSlice.reducer;
