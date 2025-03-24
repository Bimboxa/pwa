import {nanoid} from "@reduxjs/toolkit";
import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useCreateEntity() {
  // data

  const {value: userEmail} = useUserEmail();
  const listing = useSelectedListing();

  // helper

  const create = async (data) => {
    const entity = {
      id: nanoid(),
      createdBy: userEmail,
      createdAt: new Date().toISOString(),
      listingId: listing.id,
      ...data,
    };
    try {
      console.log("[db] adding entity ...", entity);
      await db.entities.add(entity);
    } catch (e) {
      console.log("[db] error adding entity", entity);
    }
  };

  return create;
}
