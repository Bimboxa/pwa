import {createSlice} from "@reduxjs/toolkit";
import {setIsEditingEntity} from "Features/entities/entitiesSlice";

const projectsInitialState = {
  projectsMap: {},
  projectsUpdatedAt: null,
  //
  selectedProjectId: "demo",
  editedProject: null,
  isEditingProject: false,
  newProject: null,
  //
};

export const projectsSlice = createSlice({
  name: "projects",
  initialState: projectsInitialState,
  reducers: {
    setSelectedProjectId: (state, action) => {
      state.selectedProjectId = action.payload;
    },
    //
    setNewProject: (state, action) => {
      state.newProject = action.payload;
    },
    setEditedProject: (state, action) => {
      state.editedProject = action.payload;
    },
    setIsEditingProject: (state, action) => {
      state.isEditingProject = action.payload;
    },
  },
});

export const {
  setSelectedProjectId,
  //
  setNewProject,
  setEditedProject,
  setIsEditingProject,
  //
} = projectsSlice.actions;

export default projectsSlice.reducer;
