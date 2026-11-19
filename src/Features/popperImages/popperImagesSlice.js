import { createSlice } from "@reduxjs/toolkit";

import {
  IMAGES_DISPLAY_MODES,
  PANEL_COLUMNS_OPTIONS,
  PRINT_ZONES_SIDES,
  PRINT_ZONES_TILE_SIZE_MODES,
  clampPrintZonesTileSizePx,
  loadImagesConnector,
  loadImagesDisplayMode,
  saveImagesConnector,
  loadPrintZonesTileSizeMode,
  loadPrintZonesTileSizePx,
  savePrintZonesTileSizeMode,
  savePrintZonesTileSizePx,
  loadImagesLinkNumber,
  loadImagesPanelColumns,
  loadPrintZonesZones,
  sanitizePrintZonesZones,
  saveImagesPanelColumns,
  savePrintZonesZones,
  saveImagesDisplayMode,
  saveImagesLinkLine,
  saveImagesLinkNumber,
} from "./services/popperImagesLocalStorage";
import getImageConnectorConfig from "Features/imageAnnotations/utils/getImageConnectorConfig";

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
// - linkLine: the connector line is drawn (see `connector.line`).
// - linkNumber: the number shows in the top-left corner of the photo / tile,
//   in the 3 display modes. Persisted.
// - connector: { color, end, line, size } — style of the photo connector:
//   colour, end marker on the anchor, line (solid / dashed / none) and
//   marker size (see getImageConnectorConfig). Persisted. `linkLine` is kept
//   in sync with it (`line !== "NONE"`): the two setters update both.
// - printZonesTileSizeMode / printZonesTileSizePx: PRINT_ZONES tile size
//   ("AUTO" shrinks to fit, "FIXED" keeps the stored size). Persisted.
// - printZonesZones: the PRINT_ZONES zones the user resized, { [side]:
//   { thickness, startInset, endInset } } px (missing = automatic), in the
//   editors; printZonesCaptureZones: same for the capture frame. Persisted.
// - printZonesPinnedSideById: { [annotationId]: side } — photos the user
//   pinned to a zone (they never change zone). Session only.
// - panelColumns: 1 | 2 columns of the overlay panel grid. Persisted.
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

const initialConnector = loadImagesConnector();

const initialState = {
  displayMode: loadImagesDisplayMode(),
  linkLine: initialConnector.line !== "NONE",
  linkNumber: loadImagesLinkNumber(),
  connector: initialConnector,
  printZonesTileSizeMode: loadPrintZonesTileSizeMode(),
  printZonesTileSizePx: loadPrintZonesTileSizePx(),
  printZonesZones: loadPrintZonesZones(),
  printZonesCaptureZones: loadPrintZonesZones(true),
  printZonesPinnedSideById: {},
  panelColumns: loadImagesPanelColumns(),
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
      // Same setting as the connector line: on = solid unless already drawn.
      if (state.linkLine !== (state.connector.line !== "NONE")) {
        state.connector = getImageConnectorConfig({
          ...state.connector,
          line: state.linkLine ? "SOLID" : "NONE",
        });
        saveImagesConnector(state.connector);
      }
    },
    setImagesLinkNumber: (state, action) => {
      state.linkNumber = Boolean(action.payload);
      saveImagesLinkNumber(state.linkNumber);
    },
    // payload: partial { color?, end?, size? }.
    setImagesConnector: (state, action) => {
      state.connector = getImageConnectorConfig({
        ...state.connector,
        ...action.payload,
      });
      saveImagesConnector(state.connector);
      state.linkLine = state.connector.line !== "NONE";
      saveImagesLinkLine(state.linkLine);
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
    // payload: { side, patch: { thickness?, startInset?, endInset? },
    // capture? } — capture: the zones of the capture frame.
    setPrintZonesZone: (state, action) => {
      const { side, patch, capture = false } = action.payload ?? {};
      if (!PRINT_ZONES_SIDES.includes(side)) return;
      const key = capture ? "printZonesCaptureZones" : "printZonesZones";
      state[key] = sanitizePrintZonesZones({
        ...state[key],
        [side]: { ...state[key][side], ...patch },
      });
      savePrintZonesZones(state[key], capture);
    },
    resetPrintZonesZones: (state) => {
      state.printZonesZones = {};
      state.printZonesCaptureZones = {};
      savePrintZonesZones({}, false);
      savePrintZonesZones({}, true);
    },
    // payload: { id, side } — side null: unpin.
    setPrintZonesImagePinnedSide: (state, action) => {
      const { id, side } = action.payload ?? {};
      if (id == null) return;
      if (PRINT_ZONES_SIDES.includes(side)) {
        state.printZonesPinnedSideById[id] = side;
      } else {
        delete state.printZonesPinnedSideById[id];
      }
    },
    setImagesPanelColumns: (state, action) => {
      if (!PANEL_COLUMNS_OPTIONS.includes(action.payload)) return;
      state.panelColumns = action.payload;
      saveImagesPanelColumns(state.panelColumns);
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
  setImagesConnector,
  setPrintZonesTileSizeMode,
  setPrintZonesTileSizePx,
  setPrintZonesZone,
  resetPrintZonesZones,
  setPrintZonesImagePinnedSide,
  setImagesPanelColumns,
  setImagesCount,
  setPrintZonesCaptureInsets,
  setImagesPhotosHidden,
  setPopperImagesCollapsed,
} = popperImagesSlice.actions;

export const selectImagesDisplayMode = (s) => s.popperImages.displayMode;
export const selectImagesLinkLine = (s) => s.popperImages.linkLine;
export const selectImagesLinkNumber = (s) => s.popperImages.linkNumber;
export const selectImagesConnector = (s) => s.popperImages.connector;
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
export const selectPrintZonesZones = (s) => s.popperImages.printZonesZones;
export const selectPrintZonesCaptureZones = (s) =>
  s.popperImages.printZonesCaptureZones;
export const selectPrintZonesPinnedSideById = (s) =>
  s.popperImages.printZonesPinnedSideById;
export const selectImagesPanelColumns = (s) => s.popperImages.panelColumns;
export const selectPrintZonesCaptureInsets = (s) =>
  s.popperImages.printZonesCaptureInsets;
export const selectImagesCount = (s) => s.popperImages.imagesCount;
export const selectImagesPhotosHidden = (s) => s.popperImages.photosHidden;
export const selectPopperImagesCollapsed = (s) => s.popperImages.collapsed;

export default popperImagesSlice.reducer;
