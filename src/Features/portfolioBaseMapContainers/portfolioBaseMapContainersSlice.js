import { createSlice } from "@reduxjs/toolkit";

const portfolioBaseMapContainersInitialState = {
  editedBaseMapContainer: null,
  framingContainerId: null,
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
    },
  },
});

export const { setEditedBaseMapContainer, setFramingContainerId } =
  portfolioBaseMapContainersSlice.actions;

export default portfolioBaseMapContainersSlice.reducer;
