import { createSlice } from "@reduxjs/toolkit";

const transformersInitialState = {
  // model loading
  ready: null,
  disabled: false,
  progressItems: [],
  output: null,

};

export const transformersSlice = createSlice({
  name: "transformers",
  initialState: transformersInitialState,
  reducers: {
    setReady: (state, action) => {
      state.ready = action.payload;
    },
    setDisabled: (state, action) => {
      state.disabled = action.payload;
    },
    setProgressItems: (state, action) => {
      state.progressItems = action.payload;
    },
    addProgressItem: (state, action) => {
      const item = action.payload; // {file,progress}
      state.progressItems = [...state.progressItems, item];
    },
    removeProgressItem: (state, action) => {
      const item = action.payload; // {file,progress}
      state.progressItems = state.progressItems.filter(progressItem => progressItem.file !== item.file);
    },
    updateProgressItem: (state, action) => {
      const item = action.payload; // {file,progress}
      state.progressItems = state.progressItems.map(progressItem => progressItem.file === item.file ? item : progressItem);
    },
    setOutput: (state, action) => {
      state.output = action.payload;
    },
  }
});

export const {
  setReady,
  setDisabled,
  setProgressItems,
  addProgressItem,
  removeProgressItem,
  updateProgressItem,
  setOutput,
} = transformersSlice.actions;

export default transformersSlice.reducer;
