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
    // options

    const updateSyncFile = options?.updateSyncFile;

    // main

    const project = {
      id: id ?? nanoid(),
      createdBy,
      createdAt,
      name,
      clientRef,
    };
    await db.projects.add(project);

    // sync file

    if (updateSyncFile) {
      const props = {item: project, type: "PROJECT"};
      if (options.updatedAt) props.updatedAt = options.updatedAt;
      if (options.syncAt) props.syncAt = options.syncAt;
      await updateItemSyncFile(props);
    }

    return project;
  };

  return create;
}
