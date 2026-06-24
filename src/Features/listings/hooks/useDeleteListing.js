import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "../listingsSlice";

import useListingsByScope from "./useListingsByScope";
import useDeleteRemoteListing from "./useDeleteRemoteListing";

import db, { withSystemWrite } from "App/db/db";
import { canEditRecord, OwnershipError } from "App/db/ownership";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

export default function useDeleteListing() {
  const dispatch = useDispatch();

  const { value: listings } = useListingsByScope();
  const deleteRemoteListing = useDeleteRemoteListing();
  const currentUserId = useSelector((state) =>
    getUserIdMaster(state.auth.userProfile)
  );

  const deleteFunc = async (listingId, options) => {
    // options
    const forceLocalToRemote = options?.forceLocalToRemote;

    // helpers
    const listing = listings.find((l) => l.id === listingId);
    const nextListings = listings?.filter((l) => l.id !== listingId);
    const nextSelectedListingId = nextListings?.[0]?.id;

    // ownership — block early, before any remote/local work
    if (listing && !canEditRecord(listing, currentUserId)) {
      throw new OwnershipError();
    }

    // remote
    if (forceLocalToRemote) {
      await deleteRemoteListing();
    }

    // main — the listing owner controls its contents, so the cascade bypasses
    // child ownership (children may have been created by other users).
    await db.listings.delete(listingId);
    await withSystemWrite(async () => {
      await db.files.where("listingId").equals(listingId).delete();
      if (listing?.table)
        await db[listing.table].where("listingId").equals(listingId).delete();
    });

    dispatch(setSelectedListingId(nextSelectedListingId));
  };

  return deleteFunc;
}
