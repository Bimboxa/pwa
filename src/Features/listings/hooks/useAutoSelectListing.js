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
  const scopeId = useSelector(s => s.scopes.selectedScopeId)

  const listings = useListings({
    filterByProjectId: projectId,
    filterByScopeId: scopeId,
    //includeListingsWithoutScope: true,
    filterByEntityModelType: "LOCATED_ENTITY",
  });


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

    if (listings?.length === 0) {
      dispatch(setSelectedListingId(null))
    }

    else if (triggerAuto) {
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
  }, [scopeId, selectedListingId, listings?.length]);

}
