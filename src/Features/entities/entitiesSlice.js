import {createSlice} from "@reduxjs/toolkit";

import exampleEntity from "./data/exampleEntity";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const entitiesInitialState = {
  entitiesById: {},
  //
  entitiesUpdatedAt: null,
  //
  selectedEntityId: null,
  newEntity: null,
  isEditingEntity: false,
  editedEntity: null,
  //
  entityTemplateUpdatedAt: null,
};

export const entitiesSlice = createSlice({
  name: "entities",
  initialState: entitiesInitialState,
  reducers: {
    setEntitiesById: (state, action) => {
      const entities = action.payload;
      state.entitiesById = getItemsByKey(entities, "id");
    },
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
      state.entitiesUpdatedAt = new Date(Date.now()).toISOString();
    },
    triggerEntityTemplateUpdate: (state) => {
      state.entityTemplateUpdatedAt = new Date(Date.now()).toISOString();
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
  setEntitiesById,
  //
  setSelectedEntityId,
  triggerEntitiesUpdate,
  //
  setNewEntity,
  setIsEditingEntity,
  setEditedEntity,
  //
  createEntity,
  updateEntity,
  //
  triggerEntityTemplateUpdate,
} = entitiesSlice.actions;

export default entitiesSlice.reducer;
