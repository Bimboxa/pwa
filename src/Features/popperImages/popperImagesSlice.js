import { createSlice } from "@reduxjs/toolkit";

import {
  IMAGES_DISPLAY_MODES,
  IMAGES_LINK_STYLES,
  loadImagesDisplayMode,
  loadImagesLinkStyle,
  saveImagesDisplayMode,
  saveImagesLinkStyle,
} from "./services/popperImagesLocalStorage";

export { IMAGES_DISPLAY_MODES, IMAGES_LINK_STYLES };

// ---------------------------------------------------------------------------
// popperImages — UI state of the PopperImages floating panel (the photos of
// the current base map) shared by the 2D editor, the 3D viewer and the
// capture overlay:
// - displayMode: "IN_SITU" (photos drawn in the scene, numbered) or "EX_SITU"
//   (photos listed as tiles in the panel, only their anchor stays in the
//   scene). Persisted per device.
// - linkStyle: how an ex-situ tile is tied to its anchor — "LINE" (leader
//   from the tile to the anchor) or "NUMBER" (same badge on both). Persisted.
// - collapsed: panel folded to its header (survives the 2D ↔ 3D remount).
// ---------------------------------------------------------------------------

const initialState = {
  displayMode: loadImagesDisplayMode(),
  linkStyle: loadImagesLinkStyle(),
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
    setImagesLinkStyle: (state, action) => {
      const style = action.payload;
      if (!IMAGES_LINK_STYLES.includes(style)) return;
      state.linkStyle = style;
      saveImagesLinkStyle(style);
    },
    setPopperImagesCollapsed: (state, action) => {
      state.collapsed = Boolean(action.payload);
    },
  },
});

export const {
  setImagesDisplayMode,
  setImagesLinkStyle,
  setPopperImagesCollapsed,
} = popperImagesSlice.actions;

export const selectImagesDisplayMode = (s) => s.popperImages.displayMode;
export const selectImagesLinkStyle = (s) => s.popperImages.linkStyle;
export const selectImagesExSitu = (s) =>
  s.popperImages.displayMode === "EX_SITU";
export const selectPopperImagesCollapsed = (s) => s.popperImages.collapsed;

export default popperImagesSlice.reducer;
