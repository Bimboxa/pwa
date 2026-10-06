import { useMemo } from "react";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

// Candidate target listings for the object library: exactly the set of listings
// that can hold annotations in the current scope — the same filter as the map
// panel (see PopperMapListings): scoped LOCATED_ENTITY listings, baseMap
// listings excluded (zonings / portfolios have their own entityModel type and
// are therefore already out).
export default function useObjectsTargetListings() {
  const { value: listings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  return useMemo(() => listings ?? [], [listings]);
}
