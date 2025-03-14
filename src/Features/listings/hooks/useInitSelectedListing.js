import {useEffect} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setSelectedListingId} from "../listingsSlice";

import useListings from "./useListings";

export default function useInitSelectedListing() {
  const dispatch = useDispatch();

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);

  const listings = useListings();

  useEffect(() => {
    if (!selectedListingId && listings?.length > 0) {
      dispatch(setSelectedListingId(listings[0].id));
    }
  }, [selectedListingId, listings?.length]);
}
