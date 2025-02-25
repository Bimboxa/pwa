import {createAsyncThunk, createSlice} from "@reduxjs/toolkit";

import {postAutoSegmentationRequest} from "./servicesAutoSegmentation";

export const createSegmentationTask = createAsyncThunk(
  "autoSegmentation/createSegmentationTask",
  postAutoSegmentationRequest
);

const autoSegmentationInitialState = {
  //
  runningTaskId: null,
  //
};

export const autoSegmentationSlice = createSlice({
  name: "autoSegmentation",
  initialState: autoSegmentationInitialState,
  reducers: {
    setSelectedProjectId: (state, action) => {
      state.selectedProjectId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(createSegmentationTask.fulfilled, (state, action) => {
      const {taskId} = action.payload;
      state.runningTaskId = taskId;
    });
  },
});

export const {
  setSelectedProjectId,
  //
} = autoSegmentationSlice.actions;

export default autoSegmentationSlice.reducer;
