import { createSlice } from "@reduxjs/toolkit";

const pointsInitialState = {
  //
  selectedPointId: null,
  //
};

export const pointsSlice = createSlice({
  name: "points",
  initialState: pointsInitialState,
  reducers: {
    setSelectedPointId: (state, action) => {
      state.selectedPointId = action.payload;
    },
  },
});

export const {
  setSelectedPointId,
} = pointsSlice.actions;

export default pointsSlice.reducer;
