import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// import randomLocatedEntitiesMap from "./data/randomLocatedEntitiesMap";
//import demoLocatedEntity from "./data/demoLocatedEntity";

import theme from "Styles/theme";

const locatedEntitiesInitialState = {
  //
  selectedTabInLeftPanel: "ANNOTATION_TEMPLATES",
  //
  locatedEntitiesMap: new Map(),
  locatedEntitiesUpdatedAt: null,
  //
  selectedLocatedEntityId: null,
  //
  newLocatedEntity: {
    label: "XXX",
  },
  editedLocatedEntity: null,
  isEditingLocatedEntity: false,
};

export const locatedEntityEditorSlice = createSlice({
  name: "locatedEntities",
  initialState: locatedEntitiesInitialState,
  reducers: {
    setSelectedTabInLeftPanel: (state, action) => {
      state.selectedTabInLeftPanel = action.payload;
    },
    //
    setSelectedLocatedEntityId: (state, action) => {
      state.selectedLocatedEntityId = action.payload;
    },
    triggerLocatedEntitiesUpdate: (state) => {
      state.locatedEntitiesUpdatedAt = Date.now();
    },
    //
    setNewLocatedEntity: (state, action) => {
      state.newLocatedEntity = action.payload;
    },
    setEditedLocatedEntity: (state, action) => {
      state.editedLocatedEntity = action.payload;
    },
    setIsEditingLocatedEntity: (state, action) => {
      state.isEditingLocatedEntity = action.payload;
    },
    createLocatedEntity: (state, action) => {
      const locatedEntity = action.payload;
      state.locatedEntitiesMap[locatedEntity.id] = locatedEntity;
    },
    updateLocatedEntity: (state, action) => {
      const updates = action.payload;
      const oldLocatedEntity = state.locatedEntitiesMap[updates.id];
      state.locatedEntitiesMap[updates.id] = {
        ...oldLocatedEntity,
        ...updates,
      };
    },
  },
});

export const {
  setSelectedTabInLeftPanel,
  //
  setSelectedLocatedEntityId,
  triggerLocatedEntitiesUpdate,
  //
  setNewLocatedEntity,
  setEditedLocatedEntity,
  setIsEditingLocatedEntity,
  //
  createLocatedEntity,
  updateLocatedEntity,
  //
} = locatedEntityEditorSlice.actions;

export default locatedEntityEditorSlice.reducer;
