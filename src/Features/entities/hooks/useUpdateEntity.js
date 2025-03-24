import {nanoid} from "@reduxjs/toolkit";
import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useUpdateEntity() {
  // data

  const {value: userEmail} = useUserEmail();

  // helper

  const update = async (entityId, updates) => {
    const changes = {
      ...updates,
      updatedBy: userEmail,
      updatedAt: new Date().toISOString(),
    };
    try {
      await db.entities.update(entityId, changes);
    } catch (e) {
      console.log("[db] error updating the entity", e);
    }
  };

  return update;
}
