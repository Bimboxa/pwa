import {createSlice} from "@reduxjs/toolkit";
import setInitProjectId from "Features/init/services/setInitProjectId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const projectsInitialState = {
  projectsById: {},
  //
  projectsMap: {},
  projectsUpdatedAt: null,
  //
  selectedProjectId: null,
  editedProject: null,
  isEditingProject: false,
  newProject: null,
  //
};

export const projectsSlice = createSlice({
  name: "projects",
  initialState: projectsInitialState,
  reducers: {
    setProjectsById: (state, action) => {
      const projects = action.payload;
      state.projectsById = getItemsByKey(projects, "id");
      state.projectsUpdatedAt = Date.now();
    },
    setSelectedProjectId: (state, action) => {
      state.selectedProjectId = action.payload;
      setInitProjectId(action.payload);
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
  setProjectsById,
  //
  setSelectedProjectId,
  //
  setNewProject,
  setEditedProject,
  setIsEditingProject,
  //
} = projectsSlice.actions;

export default projectsSlice.reducer;
