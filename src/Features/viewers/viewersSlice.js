import {createSlice} from "@reduxjs/toolkit";

const viewersInitialState = {
  //
  selectedViewerKey: "MAP", // "THREED"
};

export const viewersSlice = createSlice({
  name: "viewers",
  initialState: viewersInitialState,
  reducers: {
    setSelectedViewerKey: (state, action) => {
      state.selectedViewerKey = action.payload;
    },
  },
});

export const {
  setSelectedViewerKey,
  //
} = viewersSlice.actions;

export default viewersSlice.reducer;
