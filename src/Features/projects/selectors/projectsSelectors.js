import {createSelectorCreator, lruMemoize} from "reselect";
import isEqual from "fast-deep-equal";
import getSortedItems from "Features/misc/utils/getSortedItems";

const createDeepEqualSelector = createSelectorCreator(lruMemoize, isEqual);

export const makeGetProjectsByOptions = (options) =>
  createDeepEqualSelector(
    [
      (state) => state.projectsById, // assume projects already synced from Dexie
    ],
    (projectsById) => {
      let projects = Object.values(projectsById ?? {});

      // options

      const sortBy = options?.sortBy || "createdAt";

      // main

      if (sortBy) {
        projects = getSortedItems(projects, sortBy);
      }

      return projects;
    }
  );
