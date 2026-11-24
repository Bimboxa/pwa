import { createSlice } from "@reduxjs/toolkit";

// UI state of the orthophotos feature (unit orthophotos of an orthomosaic
// base map, db.orthophotos):
// - showStations: bottom bar toggle — the camera stations are drawn over the
//   2D editor (per-device preference, localStorage);
// - showHoverOutlines: bottom bar toggle — while the base map is hovered,
//   the outlines of the rectified images under the cursor are drawn
//   (per-device preference too);
// - selectedOrthophotoId: the station clicked — its rectified image is laid
//   over the base map and its original photo opens in PopperOrthophoto;
// - overlayOpacity: opacity of that rectified image (session only);
// - popperMode: what PopperOrthophoto shows — "SELECTION" (the original
//   photo of the selected station) or "SOURCE" (grid of the original photos
//   of the active orthophotos). The panel shows as long as the stations do;
// - editedOrthophotoId: the orthophoto whose 4 corners are being adjusted
//   from the Orthophotos tool (Fonds de plan module).

const STORAGE_KEY = "orthophotosSettings";

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      showStations: Boolean(parsed?.showStations),
      // on unless switched off
      showHoverOutlines: parsed?.showHoverOutlines !== false,
    };
  } catch {
    return { showStations: false, showHoverOutlines: true };
  }
}

function writeSettings({ showStations, showHoverOutlines }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ showStations, showHoverOutlines })
    );
  } catch {
    // storage unavailable: the preferences stay in memory
  }
}

const storedSettings = readSettings();

const orthophotosSlice = createSlice({
  name: "orthophotos",
  initialState: {
    showStations: storedSettings.showStations,
    showHoverOutlines: storedSettings.showHoverOutlines,
    selectedOrthophotoId: null,
    overlayOpacity: 1,
    editedOrthophotoId: null,
    popperMode: "SELECTION",
  },
  reducers: {
    setShowStations: (state, action) => {
      state.showStations = Boolean(action.payload);
      writeSettings(state);
      if (!state.showStations) {
        state.selectedOrthophotoId = null;
        state.editedOrthophotoId = null;
      }
    },
    setShowHoverOutlines: (state, action) => {
      state.showHoverOutlines = Boolean(action.payload);
      writeSettings(state);
    },
    setSelectedOrthophotoId: (state, action) => {
      state.selectedOrthophotoId = action.payload ?? null;
      if (state.editedOrthophotoId !== state.selectedOrthophotoId) {
        state.editedOrthophotoId = null;
      }
    },
    setOrthophotoOverlayOpacity: (state, action) => {
      const value = Number(action.payload);
      state.overlayOpacity = Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : 1;
    },
    setOrthophotoPopperMode: (state, action) => {
      state.popperMode = action.payload === "SOURCE" ? "SOURCE" : "SELECTION";
    },
    setEditedOrthophotoId: (state, action) => {
      state.editedOrthophotoId = action.payload ?? null;
      if (action.payload) state.selectedOrthophotoId = action.payload;
    },
  },
});

export const {
  setShowStations,
  setShowHoverOutlines,
  setSelectedOrthophotoId,
  setOrthophotoOverlayOpacity,
  setEditedOrthophotoId,
  setOrthophotoPopperMode,
} = orthophotosSlice.actions;

export default orthophotosSlice.reducer;
