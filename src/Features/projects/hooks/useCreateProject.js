import { nanoid } from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import useCreateRemoteProject from "Features/sync/hooks/useCreateRemoteProject";

import db from "App/db/db";
import getDateString from "Features/misc/utils/getDateString";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateProject() {
  const { value: createdBy } = useUserEmail();
  const createdAt = getDateString(new Date());

  // data

  const createRemoteProject = useCreateRemoteProject();

  // main

  const create = async ({ id, name, clientRef, type, idMaster }, options) => {
    try {
      // options

      const updateSyncFile = options?.updateSyncFile;
      const forceLocalToRemote = options?.forceLocalToRemote;

      // edge case
      if (clientRef) {
        const existingProject = await db.projects
          .where("clientRef")
          .equals(clientRef)
          .first();
        console.log("existingProject", existingProject);
        if (existingProject) {
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

      if (idMaster) project.idMaster = idMaster;
      if (type) project.type = type;

      await db.projects.add(project);

      // sync file

      if (updateSyncFile) {
        const props = { item: project, type: "PROJECT" };
        if (options.updatedAt) props.updatedAt = options.updatedAt;
        if (options.syncAt) props.syncAt = options.syncAt;
        await updateItemSyncFile(props);
      }

      // force upload;

      if (forceLocalToRemote) {
        await createRemoteProject(project);
      }

      return project;
    } catch (e) {
      console.log("[debug] error", e);
    }
  };

  return create;
}
