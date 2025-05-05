import {createSlice} from "@reduxjs/toolkit";

const relsZoneEntityInitialState = {
  //
  relsZoneEntityUpdatedAt: null,
  //
  selectedEntity: null,
  selectedZone: null,
  //
  selectedMode: "BY_ENTITY", // "BY_ZONE" or "BY_ENTITY"
  //
  selectedRelId: null,
  newRel: null,
  isEditingRel: false,
  editedRel: null,
  //
};

export const relsZoneEntitySlice = createSlice({
  name: "relsZoneEntity",
  initialState: relsZoneEntityInitialState,
  reducers: {
    setSelectedMode: (state, action) => {
      state.selectedMode = action.payload;
    },
    //
    setSelectedEntity: (state, action) => {
      state.selectedEntity = action.payload;
    },
    //
    setSelectedRelId: (state, action) => {
      state.selectedRelId = action.payload;
    },
    setNewRel: (state, action) => {
      state.newRel = action.payload;
    },
    setIsEditingRel: (state, action) => {
      state.isEditingRel = action.payload;
    },
    setEditedRel: (state, action) => {
      state.editedRel = action.payload;
    },
    //
    triggerRelsUpdate: (state) => {
      state.relsZoneEntityUpdatedAt = Date.now();
    },
    //
    createRel: (state, action) => {
      const rel = action.payload;
      state.relsZoneEntityRel[rel.id] = rel;
    },
    updateRel: (state, action) => {
      const updates = action.payload;
      const rel = state.relsZoneEntityRel[updates.id];
      state.relsZoneEntityRel[updates.id] = {...rel, ...updates};
    },
  },
});

export const {
  //
  setSelectedMode,
  //
  setSelectedEntity,
  //
  setSelectedRelId,
  triggerRelsUpdate,
  //
  setNewRel,
  setIsEditingRel,
  setEditedRel,
  //
  createRel,
  updateRel,
} = relsZoneEntitySlice.actions;

export default relsZoneEntitySlice.reducer;
