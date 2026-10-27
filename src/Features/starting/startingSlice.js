import { createSlice } from "@reduxjs/toolkit";

// « Démarrer avec <scope> » full-page dialog of the dashboard (DialogStarting):
// open flag and the section shown by its left menu (SECTIONS of
// data/startingSections). The highlight of the diagrams (concepts, app
// skeleton) is local to each section: it is transient UI state nobody else
// reads.
const initialState = {
  openDialog: false,
  sectionKey: "CONCEPTS",
};

export const startingSlice = createSlice({
  name: "starting",
  initialState,
  reducers: {
    setOpenStartingDialog: (state, action) => {
      state.openDialog = action.payload;
    },
    setStartingSectionKey: (state, action) => {
      state.sectionKey = action.payload;
    },
  },
});

export const { setOpenStartingDialog, setStartingSectionKey } =
  startingSlice.actions;

export const selectStartingDialogOpen = (s) => s.starting.openDialog;
export const selectStartingSectionKey = (s) => s.starting.sectionKey;

export default startingSlice.reducer;
