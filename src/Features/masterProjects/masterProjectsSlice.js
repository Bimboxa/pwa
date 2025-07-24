import { createSlice } from "@reduxjs/toolkit";

const masterProjectInitialState = {
  itemsMap: {},
  itemsUpdatedAt: null,
  //
  selectedMasterProjectId: null,
  //
  masterProjectPhotos: [],
};

export const masterProjectSlice = createSlice({
  name: "masterProjects",
  initialState: masterProjectInitialState,
  reducers: {
    setMasterProjectsItemsMap: (state, action) => {
      state.itemsMap = action.payload;
    },
    triggerMasterProjectsItempsUpdate: (state) => {
      state.itemsUpdatedAt = Date.now();
    },
    //
    setSelectedMasterProjectId: (state, action) => {
      state.selectedMasterProjectId = action.payload;
    },
    //
    setMasterProjectPhotos: (state, action) => {
      state.masterProjectPhotos = action.payload;
    },
  },
});

export const {
  setMasterProjectsItemsMap,
  triggerMasterProjectsItempsUpdate,
  //
  setSelectedMasterProjectId,
  //
  setMasterProjectPhotos,
} = masterProjectSlice.actions;

export default masterProjectSlice.reducer;
