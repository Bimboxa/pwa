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
      state.itemsUpdatedAt = Date.now();
    },
    addMasterProjects: (state, action) => {
      const items = action.payload;

      console.log("[STATE]debug_2101_addMasterProjects", items);

      const itemsMap = {};
      items.forEach(item => {
        const existingItem = state.itemsMap[item.id];
        if (existingItem) {
          itemsMap[item.id] = { ...existingItem, ...item };
        } else {
          itemsMap[item.id] = item;
        }
      });
      state.itemsMap = { ...state.itemsMap, ...itemsMap };
      state.itemsUpdatedAt = Date.now();
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
  addMasterProjects,
  triggerMasterProjectsItempsUpdate,
  //
  setSelectedMasterProjectId,
  //
  setMasterProjectPhotos,
} = masterProjectSlice.actions;

export default masterProjectSlice.reducer;
