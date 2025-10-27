import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "../listingsSlice";

import useListingsByScope from "./useListingsByScope";
import useListings from "./useListings";
import useSelectedListing from "./useSelectedListing";

export default function useAutoSelectListing() {
  const dispatch = useDispatch();

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const listings = useListings({
    filterByProjectId: projectId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const { value: selectedListing } = useSelectedListing();

  useEffect(() => {
    if (
      selectedListing &&
      projectId &&
      selectedListing?.projectId !== projectId
    ) {
      dispatch(setSelectedListingId(null));
    }
  }, [projectId, selectedListing?.id]);

  useEffect(() => {
    const triggerAuto = !selectedListingId && listings?.length > 0;
    console.log("[EFFECT] trigger useAutoSelectListing", triggerAuto);
    if (triggerAuto) {
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
