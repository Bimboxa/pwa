import { createSlice } from "@reduxjs/toolkit";

// State of the "Assistant IA" (ChatGPT relay) connector. The pairing token
// lives in sessionStorage (see useAssistantRelayToken) and is mirrored here.

const initialState = {
  token: null,
  connectionStatus: "idle", // idle | checking | connected | error
  connectionError: null,
  realtimeStatus: "idle", // idle | subscribed | error | unavailable

  currentSnapshot: null, // SnapshotSummary from the relay, or null
  publishStatus: { status: "idle", message: null }, // idle | publishing | success | error

  jobsById: {}, // { [jobId]: DetectionJob }
  jobActionStatusById: {}, // { [jobId]: "importing" | "rejecting" | "error" }

  baseMapJobsById: {}, // { [jobId]: BaseMapJob } (fonds de plan proposés)
  // { [jobId]: "downloading" | "rendering" | "creating" | "publishing" | "rejecting" | "error" }
  baseMapJobActionStatusById: {},
};

const assistantRelaySlice = createSlice({
  name: "assistantRelay",
  initialState,
  reducers: {
    setAssistantRelayToken: (state, action) => {
      state.token = action.payload ?? null;
      if (!state.token) {
        state.connectionStatus = "idle";
        state.connectionError = null;
        state.currentSnapshot = null;
        state.jobsById = {};
        state.baseMapJobsById = {};
        state.baseMapJobActionStatusById = {};
      }
    },
    setAssistantRelayConnection: (state, action) => {
      const { status, error } = action.payload;
      state.connectionStatus = status;
      state.connectionError = error ?? null;
    },
    setAssistantRelayRealtimeStatus: (state, action) => {
      state.realtimeStatus = action.payload;
    },
    setAssistantRelaySnapshot: (state, action) => {
      state.currentSnapshot = action.payload ?? null;
    },
    setAssistantRelayPublishStatus: (state, action) => {
      state.publishStatus = { ...state.publishStatus, ...action.payload };
    },
    upsertAssistantRelayJobs: (state, action) => {
      for (const job of action.payload ?? []) {
        if (!job?.jobId) continue;
        state.jobsById[job.jobId] = { ...state.jobsById[job.jobId], ...job };
      }
    },
    setAssistantRelayJobActionStatus: (state, action) => {
      const { jobId, status } = action.payload;
      if (status) state.jobActionStatusById[jobId] = status;
      else delete state.jobActionStatusById[jobId];
    },
    upsertAssistantRelayBaseMapJobs: (state, action) => {
      for (const job of action.payload ?? []) {
        if (!job?.jobId) continue;
        state.baseMapJobsById[job.jobId] = {
          ...state.baseMapJobsById[job.jobId],
          ...job,
        };
      }
    },
    setAssistantRelayBaseMapJobActionStatus: (state, action) => {
      const { jobId, status } = action.payload;
      if (status) state.baseMapJobActionStatusById[jobId] = status;
      else delete state.baseMapJobActionStatusById[jobId];
    },
    resetAssistantRelay: () => initialState,
  },
});

export const {
  setAssistantRelayToken,
  setAssistantRelayConnection,
  setAssistantRelayRealtimeStatus,
  setAssistantRelaySnapshot,
  setAssistantRelayPublishStatus,
  upsertAssistantRelayJobs,
  setAssistantRelayJobActionStatus,
  upsertAssistantRelayBaseMapJobs,
  setAssistantRelayBaseMapJobActionStatus,
  resetAssistantRelay,
} = assistantRelaySlice.actions;

export default assistantRelaySlice.reducer;
