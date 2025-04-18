import {useEffect} from "react";

import {useDispatch, useSelector} from "react-redux";

import {setSelectedListingId} from "../listingsSlice";

import useListingsByScope from "./useListingsByScope";

export default function useAutoSelectListing() {
  const dispatch = useDispatch();

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const {value: listings} = useListingsByScope();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const selectedListing = listings?.find((l) => l.id === selectedListingId);

  useEffect(() => {
    console.log("[EFFECT] useAutoSelectListing");
    if (!selectedListing && listings?.length > 0) {
      const firstListing = listings[0];
      if (firstListing) {
        dispatch(setSelectedListingId(firstListing.id));
      }
    }
  }, [selectedScopeId, selectedListing?.id, listings?.length]);
}
