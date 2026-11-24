import { createSlice } from "@reduxjs/toolkit";

// UI state of the orthophotos feature (unit orthophotos of an orthomosaic
// base map, db.orthophotos):
// - showStations: bottom bar toggle — the camera stations are drawn over the
//   2D editor (per-device preference, localStorage);
// - selectedOrthophotoId: the station clicked — its rectified image is laid
//   over the base map and its original photo opens in PopperOrthophoto;
// - overlayOpacity: opacity of that rectified image (session only);
// - editedOrthophotoId: the orthophoto whose 4 corners are being adjusted
//   from the Orthophotos tool (Fonds de plan module).

const STORAGE_KEY = "orthophotosSettings";

function readShowStations() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return Boolean(parsed?.showStations);
  } catch {
    return false;
  }
}

function writeShowStations(showStations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showStations }));
  } catch {
    // storage unavailable: the preference stays in memory
  }
}

const orthophotosSlice = createSlice({
  name: "orthophotos",
  initialState: {
    showStations: readShowStations(),
    selectedOrthophotoId: null,
    overlayOpacity: 1,
    editedOrthophotoId: null,
  },
  reducers: {
    setShowStations: (state, action) => {
      state.showStations = Boolean(action.payload);
      writeShowStations(state.showStations);
      if (!state.showStations) {
        state.selectedOrthophotoId = null;
        state.editedOrthophotoId = null;
      }
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
    setEditedOrthophotoId: (state, action) => {
      state.editedOrthophotoId = action.payload ?? null;
      if (action.payload) state.selectedOrthophotoId = action.payload;
    },
  },
});

export const {
  setShowStations,
  setSelectedOrthophotoId,
  setOrthophotoOverlayOpacity,
  setEditedOrthophotoId,
} = orthophotosSlice.actions;

export default orthophotosSlice.reducer;
