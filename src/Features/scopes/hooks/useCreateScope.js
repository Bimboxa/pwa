import {nanoid} from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";

export default function useCreateScope() {
  const createdBy = useUserEmail();
  const createdAt = Date.now();

  const create = async ({name, clientRef}) => {
    const scope = {
      id: nanoid(),
      createdBy,
      createdAt,
      name,
      clientRef,
    };
    await db.scopes.add(scope);
  };

  return create;
}
