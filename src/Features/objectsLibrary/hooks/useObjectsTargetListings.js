import { useMemo } from "react";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useFreeAnnotationTemplates from "Features/mapEditor/hooks/useFreeAnnotationTemplates";

// Candidate target listings for the object library: exactly the set of listings
// that can hold annotations in the current scope — the same filter as the map
// panel (see PopperMapListings): scoped LOCATED_ENTITY listings, baseMap
// listings excluded (zonings / portfolios have their own entityModel type and
// are therefore already out).
//
// The system listing ("Générique", isFreeAnnotationsListing) IS a valid target
// and comes first, mirroring its position as the first chip in the panel. The
// ensure-exists hook is called here so the option is present even when the
// object library is opened before the panel has provisioned the scope.
export default function useObjectsTargetListings() {
  useFreeAnnotationTemplates();

  const { value: listings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  return useMemo(() => {
    const all = listings ?? [];
    return [
      ...all.filter((l) => l.isFreeAnnotationsListing),
      ...all.filter((l) => !l.isFreeAnnotationsListing),
    ];
  }, [listings]);
}
