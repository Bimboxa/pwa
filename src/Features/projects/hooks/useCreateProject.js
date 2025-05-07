import {nanoid} from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";
import getDateString from "Features/misc/utils/getDateString";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateProject() {
  const {value: createdBy} = useUserEmail();
  const createdAt = getDateString(new Date());

  // main

  const create = async ({name, clientRef, id}, options) => {
    try {
      // options

      const updateSyncFile = options?.updateSyncFile;

      // edge case
      if (clientRef) {
        const existingProjects = db.projects
          .where("clientRef")
          .equals(clientRef);
        if (existingProjects) {
          console.error("Project already exists with this ref");
          return;
        }
      }

      // main

      const project = {
        id: id ?? nanoid(),
        createdBy,
        createdAt,
        name,
        clientRef,
      };
      await db.projects.put(project);
      console.log("debug_2504 [db] added project", project);

      // sync file

      if (updateSyncFile) {
        const props = {item: project, type: "PROJECT"};
        if (options.updatedAt) props.updatedAt = options.updatedAt;
        if (options.syncAt) props.syncAt = options.syncAt;
        await updateItemSyncFile(props);
      }

      return project;
    } catch (e) {
      console.log("[debug] error", e);
    }
  };

  return create;
}
