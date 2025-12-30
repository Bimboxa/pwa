import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "../listingsSlice";

import useListingsByScope from "./useListingsByScope";
import useDeleteRemoteListing from "./useDeleteRemoteListing";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import db from "App/db/db";

export default function useDeleteListing() {
  const dispatch = useDispatch();

  const { value: listings, loading } = useListingsByScope();
  const deleteRemoteListing = useDeleteRemoteListing();
  const updateScope = useUpdateScope();
  const { value: scope } = useSelectedScope();

  const deleteFunc = async (listingId, options) => {
    // options
    const forceLocalToRemote = options?.forceLocalToRemote;

    // helpers
    const listing = listings.find((l) => l.id === listingId);
    const nextListings = listings?.filter((l) => l.id !== listingId);
    const nextSelectedListingId = nextListings?.[0]?.id;

    // scope

    if (scope.sortedListings) {
      const nextSortedListings = scope.sortedListings.filter((l) => l.id !== listingId);
      await updateScope({ id: scope?.id, sortedListings: nextSortedListings });
    }

    // remote
    if (forceLocalToRemote) {
      await deleteRemoteListing();
    }

    // main
    await db.listings.delete(listingId);
    await db.files.where("listingId").equals(listingId).delete();
    if (listing?.table)
      await db[listing.table].where("listingId").equals(listingId).delete();

    dispatch(setSelectedListingId(nextSelectedListingId));
  };

  return deleteFunc;
}
