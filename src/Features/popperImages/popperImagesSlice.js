import { createSlice } from "@reduxjs/toolkit";

import {
  IMAGES_DISPLAY_MODES,
  PRINT_ZONES_TILE_SIZE_MODES,
  clampPrintZonesTileSizePx,
  loadImagesDisplayMode,
  loadPrintZonesTileSizeMode,
  loadPrintZonesTileSizePx,
  savePrintZonesTileSizeMode,
  savePrintZonesTileSizePx,
  loadImagesLinkLine,
  loadImagesLinkNumber,
  saveImagesDisplayMode,
  saveImagesLinkLine,
  saveImagesLinkNumber,
} from "./services/popperImagesLocalStorage";

export { IMAGES_DISPLAY_MODES };

// ---------------------------------------------------------------------------
// popperImages — display state of the photos (IMAGE annotations) of the
// current base map, shared by the 2D editor, the 3D viewer, the capture
// overlay and the bottom bar controls (SectionImagesBottomBarControls):
// - displayMode: "IN_SITU" (photos drawn in the scene, numbered), "EX_SITU"
//   (overlay: photos listed as tiles in the floating PopperImages panel) or
//   "PRINT_ZONES" (tiles dispatched in 4 bands along the editor / capture
//   frame edges). Off in situ, only the anchor stays in the scene.
//   Persisted per device.
// - linkLine / linkNumber: how a tile is tied to its anchor — a leader from
//   the tile to the anchor, and / or the same number badge on both.
//   Independent toggles, both persisted.
// - printZonesTileSizeMode / printZonesTileSizePx: PRINT_ZONES tile size
//   ("AUTO" shrinks to fit, "FIXED" keeps the stored size). Persisted.
// - photosHidden: the count pill toggles the photos off — nothing of them
//   in the scene (no card, no anchor, no leader) and greyed tiles.
//   Session only.
// - printZonesCaptureInsets: { top, right, bottom, left } px taken by the
//   print zones bands inside the capture frame (published by
//   CaptureImagePrintZonesOverlay, null when none), so the labels margin
//   band stays clear of the tiles.
// - imagesCount: number of photos displayed by the active editor (published
//   by the editors, read by the bottom bar to show its controls).
// - collapsed: panel folded to its header (survives the 2D ↔ 3D remount).
// ---------------------------------------------------------------------------

const initialState = {
  displayMode: loadImagesDisplayMode(),
  linkLine: loadImagesLinkLine(),
  linkNumber: loadImagesLinkNumber(),
  printZonesTileSizeMode: loadPrintZonesTileSizeMode(),
  printZonesTileSizePx: loadPrintZonesTileSizePx(),
  photosHidden: false,
  collapsed: false,
  imagesCount: 0,
  printZonesCaptureInsets: null,
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
    setPrintZonesTileSizeMode: (state, action) => {
      const mode = action.payload;
      if (!PRINT_ZONES_TILE_SIZE_MODES.includes(mode)) return;
      state.printZonesTileSizeMode = mode;
      savePrintZonesTileSizeMode(mode);
    },
    setPrintZonesTileSizePx: (state, action) => {
      state.printZonesTileSizePx = clampPrintZonesTileSizePx(action.payload);
      savePrintZonesTileSizePx(state.printZonesTileSizePx);
    },
    setImagesCount: (state, action) => {
      state.imagesCount = Math.max(0, Number(action.payload) || 0);
    },
    setPrintZonesCaptureInsets: (state, action) => {
      state.printZonesCaptureInsets = action.payload ?? null;
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
  setPrintZonesTileSizeMode,
  setPrintZonesTileSizePx,
  setImagesCount,
  setPrintZonesCaptureInsets,
  setImagesPhotosHidden,
  setPopperImagesCollapsed,
} = popperImagesSlice.actions;

export const selectImagesDisplayMode = (s) => s.popperImages.displayMode;
export const selectImagesLinkLine = (s) => s.popperImages.linkLine;
export const selectImagesLinkNumber = (s) => s.popperImages.linkNumber;
export const selectImagesExSitu = (s) =>
  s.popperImages.displayMode === "EX_SITU";
export const selectImagesPrintZones = (s) =>
  s.popperImages.displayMode === "PRINT_ZONES";
// Off in situ (overlay or print zones): only the anchors stay in the scene.
export const selectImagesOffMap = (s) =>
  s.popperImages.displayMode !== "IN_SITU";
export const selectPrintZonesTileSizeMode = (s) =>
  s.popperImages.printZonesTileSizeMode;
export const selectPrintZonesTileSizePx = (s) =>
  s.popperImages.printZonesTileSizePx;
export const selectPrintZonesCaptureInsets = (s) =>
  s.popperImages.printZonesCaptureInsets;
export const selectImagesCount = (s) => s.popperImages.imagesCount;
export const selectImagesPhotosHidden = (s) => s.popperImages.photosHidden;
export const selectPopperImagesCollapsed = (s) => s.popperImages.collapsed;

export default popperImagesSlice.reducer;
