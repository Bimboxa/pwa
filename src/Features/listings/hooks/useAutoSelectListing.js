import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "../listingsSlice";

import useListingsByScope from "./useListingsByScope";
import useSelectedListing from "./useSelectedListing";

export default function useAutoSelectListing() {
  const dispatch = useDispatch();

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const { value: listings } = useListingsByScope();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const { value: selectedListing } = useSelectedListing();
  useEffect(() => {
    console.log(
      "[EFFECT] useAutoSelectListing",
      listings,
      !Boolean(selectedListing?.id)
    );
    if (!selectedListing?.id && listings?.length > 0) {
      console.log("[EFFECT] useAutoSelectListing - set First listing");
      const firstListing = listings[0];
      if (firstListing) {
        console.log(
          "[EFFECT] useAutoSelectListing - set First listing",
          firstListing
        );
        dispatch(setSelectedListingId(firstListing.id));
      }
    }
  }, [selectedScopeId, selectedListingId, listings?.length]);
}
