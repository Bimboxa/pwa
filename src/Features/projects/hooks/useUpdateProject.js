import {nanoid} from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";

export default function useUpdateProject() {
  const updatedAt = Date.now();

  const update = async (updates) => {
    const coreUpdates = {...updates, updatedAt};
    delete coreUpdates.id;
    await db.projects.update(updates.id, coreUpdates);
  };

  return update;
}
