import { createSlice } from "@reduxjs/toolkit";

import {
  IMAGES_DISPLAY_MODES,
  loadImagesDisplayMode,
  loadImagesLinkLine,
  loadImagesLinkNumber,
  saveImagesDisplayMode,
  saveImagesLinkLine,
  saveImagesLinkNumber,
} from "./services/popperImagesLocalStorage";

export { IMAGES_DISPLAY_MODES };

// ---------------------------------------------------------------------------
// popperImages — UI state of the PopperImages floating panel (the photos of
// the current base map) shared by the 2D editor, the 3D viewer and the
// capture overlay:
// - displayMode: "IN_SITU" (photos drawn in the scene, numbered) or "EX_SITU"
//   (photos listed as tiles in the panel, only their anchor stays in the
//   scene). Persisted per device.
// - linkLine / linkNumber: how an ex-situ tile is tied to its anchor — a
//   leader from the tile to the anchor, and / or the same number badge on
//   both. Independent switches, both persisted.
// - photosHidden: the header count pill toggles the photos off — nothing of
//   them in the scene (no card, no anchor, no leader) and greyed tiles.
//   Session only.
// - collapsed: panel folded to its header (survives the 2D ↔ 3D remount).
// ---------------------------------------------------------------------------

const initialState = {
  displayMode: loadImagesDisplayMode(),
  linkLine: loadImagesLinkLine(),
  linkNumber: loadImagesLinkNumber(),
  photosHidden: false,
  collapsed: false,
};

export const popperImagesSlice = createSlice({
  name: "popperImages",
  initialState,
  reducers: {
    setImagesDisplayMode: (state, action) => {
      const mode = action.payload;
      if (!IMAGES_DISPLAY_MODES.includes(mode)) return;
      state.displayMode = mode;
      saveImagesDisplayMode(mode);
    },
    setImagesLinkLine: (state, action) => {
      state.linkLine = Boolean(action.payload);
      saveImagesLinkLine(state.linkLine);
    },
    setImagesLinkNumber: (state, action) => {
      state.linkNumber = Boolean(action.payload);
      saveImagesLinkNumber(state.linkNumber);
    },
    setImagesPhotosHidden: (state, action) => {
      state.photosHidden = Boolean(action.payload);
    },
    setPopperImagesCollapsed: (state, action) => {
      state.collapsed = Boolean(action.payload);
    },
  },
});

export const {
  setImagesDisplayMode,
  setImagesLinkLine,
  setImagesLinkNumber,
  setImagesPhotosHidden,
  setPopperImagesCollapsed,
} = popperImagesSlice.actions;

export const selectImagesDisplayMode = (s) => s.popperImages.displayMode;
export const selectImagesLinkLine = (s) => s.popperImages.linkLine;
export const selectImagesLinkNumber = (s) => s.popperImages.linkNumber;
export const selectImagesExSitu = (s) =>
  s.popperImages.displayMode === "EX_SITU";
export const selectImagesPhotosHidden = (s) => s.popperImages.photosHidden;
export const selectPopperImagesCollapsed = (s) => s.popperImages.collapsed;

export default popperImagesSlice.reducer;
