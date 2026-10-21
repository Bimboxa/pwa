import { createSlice } from "@reduxjs/toolkit";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { DEFAULT_TOLERANCE_CM } from "./constants/duplicatesDetectionConstants";

// « Détection des doublons »: status and result of the last run. A non-idle
// status swaps the Dessin panel / popper to the duplicates helper (one row
// per duplicate, « Relancer », tolerance field). `toleranceCm` is the user
// setting of the helper and survives clearDetection.
const initialState = {
  status: "idle", // "idle" | "running" | "done" | "error"
  runId: null,
  baseMapId: null,
  result: null, // findOverlappingAnnotations output
  error: null,
  toleranceCm: DEFAULT_TOLERANCE_CM,
  // run parameters, kept to format the rows (px → m)
  thresholdPx: null,
  meterByPx: null,
  hasScale: false,
  startedAt: null,
  finishedAt: null,
};

function resetRun(state) {
  Object.assign(state, initialState, { toleranceCm: state.toleranceCm });
}

const duplicatesDetectionSlice = createSlice({
  name: "duplicatesDetection",
  initialState,
  reducers: {
    startDetection: (state, action) => {
      const { runId, baseMapId, thresholdPx, meterByPx, hasScale, startedAt } =
        action.payload;
      state.status = "running";
      state.runId = runId;
      // the previous result stays until the new one lands (no list flash)
      if (state.baseMapId !== baseMapId) state.result = null;
      state.baseMapId = baseMapId ?? null;
      state.error = null;
      state.thresholdPx = thresholdPx ?? null;
      state.meterByPx = meterByPx ?? null;
      state.hasScale = Boolean(hasScale);
      state.startedAt = startedAt ?? Date.now();
      state.finishedAt = null;
    },
    finishDetection: (state, action) => {
      const { runId, result, finishedAt } = action.payload;
      if (runId !== state.runId) return; // stale run
      state.status = "done";
      state.result = result ?? null;
      state.error = null;
      state.finishedAt = finishedAt ?? Date.now();
    },
    failDetection: (state, action) => {
      const { runId, error } = action.payload;
      if (runId !== state.runId) return;
      state.status = "error";
      state.error = error ?? "Duplicates detection failed";
      state.finishedAt = Date.now();
    },
    setToleranceCm: (state, action) => {
      const value = Number(action.payload);
      if (!Number.isFinite(value) || value <= 0) return;
      state.toleranceCm = value;
    },
    clearDetection: (state) => {
      resetRun(state);
    },
  },
  extraReducers: (builder) => {
    // The result belongs to one base map: switching it closes the helper.
    builder.addCase(setSelectedMainBaseMapId, (state, action) => {
      if (state.status === "idle") return;
      if (action.payload === state.baseMapId) return;
      resetRun(state);
    });
  },
});

export const {
  startDetection,
  finishDetection,
  failDetection,
  setToleranceCm,
  clearDetection,
} = duplicatesDetectionSlice.actions;

export const selectDuplicatesDetectionStatus = (state) =>
  state.duplicatesDetection.status;
export const selectDuplicatesDetectionActive = (state) =>
  state.duplicatesDetection.status !== "idle";
export const selectDuplicatesDetectionRunning = (state) =>
  state.duplicatesDetection.status === "running";

export default duplicatesDetectionSlice.reducer;
