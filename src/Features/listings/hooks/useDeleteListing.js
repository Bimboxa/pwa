import {useDispatch, useSelector} from "react-redux";

import {setSelectedListingId} from "../listingsSlice";

import useListingsByScope from "./useListingsByScope";
import useDeleteRemoteListing from "./useDeleteRemoteListing";

import db from "App/db/db";

export default function useDeleteListing() {
  const dispatch = useDispatch();

  const {value: listings, loading} = useListingsByScope();
  const deleteRemoteListing = useDeleteRemoteListing();

  const deleteFunc = async (listingId, options) => {
    // options
    const forceLocalToRemote = options?.forceLocalToRemote;

    // helpers
    const listing = listings.find((l) => l.id === listingId);
    const nextListings = listings?.filter((l) => l.id !== listingId);
    const nextSelectedListingId = nextListings?.[0]?.id;

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
