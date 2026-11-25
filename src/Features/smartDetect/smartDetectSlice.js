import { createSlice } from "@reduxjs/toolkit";

import { grey } from "@mui/material/colors";

// Shapes of the room detected by the « Pièce » tool (ROOM_CLICK), in the
// order the F key cycles them.
export const ROOM_SHAPES = ["AUTO", "RECTANGLE", "L"];

// Side of the computation window of the « Pièce » tool, metres.
export const ROOM_WINDOW_MIN_M = 2;
export const ROOM_WINDOW_MAX_M = 60;
const ROOM_WINDOW_STEP = 1.25;

const smartDetectInitialState = {
  //
  centerColor: grey[500],
  rawDetection: false,
  noCuts: false,
  noSmallCuts: true,
  convexHull: false,
  // When true, the SURFACE_DROP flood fill ignores the base map image content
  // and runs on an all-white binary, so it is bounded only by existing
  // annotation footprints (and the viewport ROI).
  ignoreBaseMap: false,
  // SURFACE_DROP flood fill: max per-channel RGB distance (0..255) between a
  // pixel and the clicked colour for the pixel to belong to the filled area.
  colorTolerance: 15,
  // When true, the SURFACE_DROP tool ("goutte d'eau") ignores the OpenCV
  // image flood fill on click and instead runs the annotation-geometry
  // detection (detectPolygonFromAnnotations), building the polygon from the
  // contours formed by the surrounding annotations — same algorithm as the
  // POLYGON_CLICK hover smart-detect (S key).
  useOutlines: false,
  // « Pièce » tool (ROOM_CLICK, see utils/detectRoomAtPoint.js):
  //   - roomShape: "AUTO" (rectangle + extensions through the openings wider
  //     than a door), "RECTANGLE" (no extension) or "L" (one extension, even
  //     through an opening no wider than a door — corridor).
  //   - roomIgnoreColoredLines: coloured strokes (axes, networks…) are not
  //     read as walls.
  roomShape: "AUTO",
  roomIgnoreColoredLines: true,
  //   - roomWindowSizeM: side (metres) of the square around the cursor the
  //     detection is limited to (Z enlarges, W shrinks). A room must fit in
  //     it; the smaller, the faster.
  roomWindowSizeM: 10,
  visibleAreaOnly: true,
  //
  simplifyPolynomial: true,
  simplifyOuterContour: false,
  simplifyRightAngles: false,
  //
  // When true (default), pressing Space to commit detected strips runs
  // cleanSegments on (detected strips + visible 2-point POLYLINEs) before
  // persisting. See docs/smartDetect/CLEAN_ON_COMMIT.md.
  cleanOnCommit: true,
};

export const smartDetectSlice = createSlice({
  name: "smartDetect",
  initialState: smartDetectInitialState,
  reducers: {
    setCenterColor: (state, action) => {
      state.centerColor = action.payload;
    },
    setRawDetection: (state, action) => {
      state.rawDetection = action.payload;
    },
    setNoCuts: (state, action) => {
      state.noCuts = action.payload;
    },
    setNoSmallCuts: (state, action) => {
      state.noSmallCuts = action.payload;
    },
    setConvexHull: (state, action) => {
      state.convexHull = action.payload;
    },
    setIgnoreBaseMap: (state, action) => {
      state.ignoreBaseMap = action.payload;
    },
    setColorTolerance: (state, action) => {
      state.colorTolerance = action.payload;
    },
    setUseOutlines: (state, action) => {
      state.useOutlines = action.payload;
    },
    setRoomShape: (state, action) => {
      state.roomShape = action.payload;
    },
    cycleRoomShape: (state) => {
      const index = ROOM_SHAPES.indexOf(state.roomShape);
      state.roomShape = ROOM_SHAPES[(index + 1) % ROOM_SHAPES.length];
    },
    setRoomIgnoreColoredLines: (state, action) => {
      state.roomIgnoreColoredLines = action.payload;
    },
    // payload: +1 (larger) / -1 (smaller)
    stepRoomWindowSize: (state, action) => {
      const factor =
        action.payload > 0 ? ROOM_WINDOW_STEP : 1 / ROOM_WINDOW_STEP;
      const size = Math.round(state.roomWindowSizeM * factor * 10) / 10;
      state.roomWindowSizeM = Math.max(
        ROOM_WINDOW_MIN_M,
        Math.min(ROOM_WINDOW_MAX_M, size)
      );
    },
    setVisibleAreaOnly: (state, action) => {
      state.visibleAreaOnly = action.payload;
    },
    setSimplifyPolynomial: (state, action) => {
      state.simplifyPolynomial = action.payload;
    },
    setSimplifyOuterContour: (state, action) => {
      state.simplifyOuterContour = action.payload;
    },
    setSimplifyRightAngles: (state, action) => {
      state.simplifyRightAngles = action.payload;
    },
    setCleanOnCommit: (state, action) => {
      state.cleanOnCommit = action.payload;
    },
  },
});

export const {
  setCenterColor,
  setRawDetection,
  setNoCuts,
  setNoSmallCuts,
  setConvexHull,
  setIgnoreBaseMap,
  setColorTolerance,
  setUseOutlines,
  setRoomShape,
  cycleRoomShape,
  setRoomIgnoreColoredLines,
  stepRoomWindowSize,
  setVisibleAreaOnly,
  setSimplifyPolynomial,
  setSimplifyOuterContour,
  setSimplifyRightAngles,
  setCleanOnCommit,
} = smartDetectSlice.actions;

export default smartDetectSlice.reducer;
