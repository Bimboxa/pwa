import {createSlice} from "@reduxjs/toolkit";

import exampleEntity from "./data/exampleEntity";

const entitiesInitialState = {
  //
  entitiesMap: {[exampleEntity.id]: exampleEntity},
  entitiesUpdatedAt: null,
  //
  selectedEntityId: null,
  newEntity: null,
  isEditingEntity: false,
  editedEntity: null,
  //
};

export const entitiesSlice = createSlice({
  name: "entities",
  initialState: entitiesInitialState,
  reducers: {
    setSelectedEntityId: (state, action) => {
      state.selectedEntityId = action.payload;
    },
    setNewEntity: (state, action) => {
      state.newEntity = action.payload;
    },
    setIsEditingEntity: (state, action) => {
      state.isEditingEntity = action.payload;
    },
    setEditedEntity: (state, action) => {
      state.editedEntity = action.payload;
    },
    //
    triggerEntitiesUpdate: (state) => {
      state.entitiesUpdatedAt = Date.now();
    },
    //
    createEntity: (state, action) => {
      const entity = action.payload;
      state.entitiesEntity[entity.id] = entity;
    },
    updateEntity: (state, action) => {
      const updates = action.payload;
      const entity = state.entitiesEntity[updates.id];
      state.entitiesEntity[updates.id] = {...entity, ...updates};
    },
  },
});

export const {
  setSelectedEntityId,
  triggerEntitiesUpdate,
  //
  setNewEntity,
  setIsEditingEntity,
  setEditedEntity,
  //
  createEntity,
  updateEntity,
} = entitiesSlice.actions;

export default entitiesSlice.reducer;
