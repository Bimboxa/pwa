import {nanoid} from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";

export default function useCreateProject() {
  const createdBy = useUserEmail();
  const createdAt = Date.now();

  const create = async ({name, clientRef}) => {
    const project = {
      id: nanoid(),
      createdBy,
      createdAt,
      name,
      clientRef,
    };
    await db.projects.add(project);
  };

  return create;
}
