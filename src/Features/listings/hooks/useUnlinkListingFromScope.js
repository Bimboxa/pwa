import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "../listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import unlinkListingFromScopeService from "../services/unlinkListingFromScopeService";

// "Retirer du Krto": drops the link of a listing into the selected scope. The
// listing and its content stay in their source scope. Deselects the listing
// when it was the selected one.
export default function useUnlinkListingFromScope() {
  const dispatch = useDispatch();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);

  return useCallback(
    async (listingId) => {
      if (!selectedScopeId || !listingId) return 0;
      try {
        const count = await unlinkListingFromScopeService({
          hostScopeId: selectedScopeId,
          listingId,
        });
        if (selectedListingId === listingId) {
          dispatch(setSelectedListingId(null));
          dispatch(setSelectedItem(null));
        }
        return count;
      } catch (error) {
        console.error("[useUnlinkListingFromScope]", error);
        dispatch(
          setToaster({
            message: error?.message ?? "Impossible de retirer la liste",
            isError: true,
          })
        );
        return 0;
      }
    },
    [selectedScopeId, selectedListingId, dispatch]
  );
}
