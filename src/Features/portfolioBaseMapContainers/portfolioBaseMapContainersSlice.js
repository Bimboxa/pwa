import { createSlice } from "@reduxjs/toolkit";

// framingMode: "FRAME" (« Cadrer »: pan + wheel zoom + crop handles) or
// "CROP" (« Croper »: pan + crop handles, no zoom — scale preserved).
const portfolioBaseMapContainersInitialState = {
  editedBaseMapContainer: null,
  framingContainerId: null,
  framingMode: null,
};

export const portfolioBaseMapContainersSlice = createSlice({
  name: "portfolioBaseMapContainers",
  initialState: portfolioBaseMapContainersInitialState,
  reducers: {
    setEditedBaseMapContainer: (state, action) => {
      state.editedBaseMapContainer = action.payload;
    },
    setFramingContainerId: (state, action) => {
      state.framingContainerId = action.payload;
      if (!action.payload) state.framingMode = null;
    },
    setFramingMode: (state, action) => {
      state.framingMode = action.payload;
    },
  },
});

export const {
  setEditedBaseMapContainer,
  setFramingContainerId,
  setFramingMode,
} = portfolioBaseMapContainersSlice.actions;

export default portfolioBaseMapContainersSlice.reducer;
