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

  const {value: listings} = useListings({
    filterByProjectId: projectId,
    filterByScopeId: scopeId,
    //includeListingsWithoutScope: true,
    filterByEntityModelType: "LOCATED_ENTITY",
  });


  // Every listing displayable in the scope (own, shared BASE_MAP / PHOTO,
  // linked from another scope) — the membership rule of the SCOPE panel.
  const { value: scopeListings } = useListingsByScope({
    filterByProjectId: projectId,
  });
  const scopeListingIdsKey = scopeListings?.map((l) => l.id).join(",") ?? "";

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

  // Scope switch (top bar) with the module kept: a listing of the previous
  // scope must not survive — drop it, the effect below picks the first
  // annotation listing of the new scope. Gated on a non-empty scope list so
  // a not-yet-hydrated store never clears a valid selection.
  useEffect(() => {
    if (!selectedListingId || !scopeId || !scopeListings?.length) return;
    const inScope = scopeListings.some((l) => l.id === selectedListingId);
    if (!inScope) dispatch(setSelectedListingId(null));
  }, [scopeId, selectedListingId, scopeListingIdsKey]);


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
