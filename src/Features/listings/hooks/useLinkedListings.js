import { useCallback, useMemo } from "react";
import { useSelector } from "react-redux";

import { selectLinkedListingSourceForSelectedScope } from "../selectors/listingsSelectors";

// The single UI notion of "listing linked from another scope" for the
// selected scope ("Depuis un autre Krto"): read-only rows, coloured with
// palette.listingFromOtherScope, "Retirer" instead of delete.
// Returns {linkedSourceByListingId, isLinkedListing(id), getSourceScope(id)}.
export default function useLinkedListings() {
  const linkedSourceByListingId = useSelector(
    selectLinkedListingSourceForSelectedScope
  );
  const scopesById = useSelector((s) => s.scopes.scopesById);

  const isLinkedListing = useCallback(
    (listingId) => Boolean(listingId && linkedSourceByListingId[listingId]),
    [linkedSourceByListingId]
  );

  const getSourceScope = useCallback(
    (listingId) => {
      const sourceScopeId = listingId
        ? linkedSourceByListingId[listingId]
        : null;
      return sourceScopeId ? (scopesById?.[sourceScopeId] ?? null) : null;
    },
    [linkedSourceByListingId, scopesById]
  );

  const hasLinkedListings = useMemo(
    () => Object.keys(linkedSourceByListingId).length > 0,
    [linkedSourceByListingId]
  );

  return {
    linkedSourceByListingId,
    hasLinkedListings,
    isLinkedListing,
    getSourceScope,
  };
}
