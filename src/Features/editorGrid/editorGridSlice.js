import { createSlice } from "@reduxjs/toolkit";

import {
  loadEditorGridSettings,
  saveEditorGridSettings,
} from "./services/editorGridLocalStorage";

// Editor grid (« Grille » command of the commands toolbar): a metric grid
// drawn over the current base map of the 2D editor, whose nodes are snap
// targets while drawing / moving. A view setting of the device (localStorage),
// NOT a property of the base map.
// - enabled: grid shown + snappable.
// - stepM: cell size in metres (fixed mode).
// - dynamic: the cell size follows the zoom level (same rounded lengths as
//   the scale indicator) instead of stepM.
// The grid actually drawn (secondary cells + main grid) derives from these
// and from the zoom: utils/getDisplayedGrid.js.
const persisted = loadEditorGridSettings();

const initialState = {
  enabled: persisted.enabled,
  stepM: persisted.stepM,
  dynamic: persisted.dynamic,
};

const editorGridSlice = createSlice({
  name: "editorGrid",
  initialState,
  reducers: {
    setEditorGridEnabled: (state, action) => {
      state.enabled = Boolean(action.payload);
      saveEditorGridSettings({ enabled: state.enabled });
    },
    setEditorGridStepM: (state, action) => {
      const stepM = Number(action.payload);
      if (!(stepM > 0)) return;
      state.stepM = stepM;
      saveEditorGridSettings({ stepM });
    },
    setEditorGridDynamic: (state, action) => {
      state.dynamic = Boolean(action.payload);
      saveEditorGridSettings({ dynamic: state.dynamic });
    },
  },
});

export const {
  setEditorGridEnabled,
  setEditorGridStepM,
  setEditorGridDynamic,
} = editorGridSlice.actions;

export default editorGridSlice.reducer;
