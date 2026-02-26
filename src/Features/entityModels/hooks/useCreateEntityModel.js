import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

export default function useCreateEntityModel() {
  const create = async (data) => {
    const id = nanoid();
    const entityModel = {
      id,
      ...data,
    };
    await db.entityModels.add(entityModel);
    return entityModel;
  };

  return create;
}
