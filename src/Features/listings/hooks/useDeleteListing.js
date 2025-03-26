import {useDispatch, useSelector} from "react-redux";

import {setSelectedListingId} from "../listingsSlice";

import useListingsByScope from "./useListingsByScope";

import db from "App/db/db";

export default function useDeleteListing() {
  const dispatch = useDispatch();

  const {value: listings, loading} = useListingsByScope();

  const deleteFunc = async (listingId) => {
    const nextListings = listings?.filter((l) => l.id !== listingId);
    const nextSelectedListingId = nextListings?.[0]?.id;

    await db.listings.delete(listingId);
    await db.relsScopeItem
      .where("[itemTable+itemId]")
      .equals(["listings", listingId])
      .delete();
    await db.files.where("listingId").equals(listingId).delete();
    await db.entitites.where("listingId").equals(listingId).delete();

    dispatch(setSelectedListingId(nextSelectedListingId));
  };

  return deleteFunc;
}
