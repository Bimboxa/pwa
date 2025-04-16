import {createSelectorCreator, lruMemoize} from "reselect";
import isEqual from "fast-deep-equal";
import getSortedItems from "Features/misc/utils/getSortedItems";

const createDeepEqualSelector = createSelectorCreator(lruMemoize, isEqual);

export const makeGetProjectsByOptions = (options) =>
  createDeepEqualSelector(
    [
      (state) => state.projects.projectsUpdatedAt,
      (state) => state.projects.projectsById,
    ],
    (projectsUpdatedAt, projectsById) => {
      // options

      const sortBy = options?.sortBy || "createdAt";

      // edge case

      if (!projectsUpdatedAt) return [];

      // main

      let projects = Object.values(projectsById ?? {});

      // main

      if (sortBy) {
        projects = getSortedItems(projects, sortBy);
      }

      return projects;
    }
  );

export const makeGetProjectByOptions = (options) =>
  createDeepEqualSelector(
    [
      (state) => state.projects.selectedProjectId,
      (state) => state.projects.newProject,
      (state) => state.projects.editedProject,
      (state) => state.projects.isEditingProject,
      (state) => state.projects.projectsUpdatedAt,
      (state) => state.projects.projectsById,
    ],
    (
      selectedProjectId,
      newProject,
      editedProject,
      isEditingProject,
      projectsUpdatedAt,
      projectsById
    ) => {
      // edge case
      if (!projectsUpdatedAt) return null;

      // main
      const forceNew = options?.forceNew;

      if (!selectedProjectId) {
        return isEditingProject ? editedProject : newProject;
      }

      if (forceNew) {
        return newProject;
      }

      return projectsById[selectedProjectId] ?? null;
    }
  );
