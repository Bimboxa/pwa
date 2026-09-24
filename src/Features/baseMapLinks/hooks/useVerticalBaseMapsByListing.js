import { useMemo } from "react";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";

// VERTICAL base maps (élévations / coupes) of the project, grouped by listing
// in the project listings order — same grouping as ElevationBaseMapSelector,
// extracted so the BASE_MAP_LINK target menu shares it.
//
// Returns { baseMaps, groups: [{ listing, baseMaps }] }.
export default function useVerticalBaseMapsByListing() {
  const { value: allBaseMaps = [] } = useBaseMaps({});
  const listings = useProjectBaseMapListings() ?? [];
  const { disabledListingIds } = useDisabledBaseMapListingIds();

  // Filter the baseMaps (not the listings): filtering listings alone would
  // dump the disabled listings' baseMaps into the "Autres" leftover group.
  const baseMaps = useMemo(
    () =>
      (allBaseMaps ?? []).filter(
        (bm) =>
          !bm?.isPhoto &&
          bm?.orientation === "VERTICAL" &&
          !disabledListingIds.includes(bm?.listingId)
      ),
    [allBaseMaps, disabledListingIds]
  );

  const groups = useMemo(() => {
    const byListing = new Map();
    for (const bm of baseMaps) {
      const key = bm.listingId ?? "__none__";
      if (!byListing.has(key)) byListing.set(key, []);
      byListing.get(key).push(bm);
    }
    const ordered = [];
    for (const listing of listings) {
      if (byListing.has(listing.id)) {
        ordered.push({ listing, baseMaps: byListing.get(listing.id) });
        byListing.delete(listing.id);
      }
    }
    for (const [key, bms] of byListing) {
      ordered.push({ listing: { id: key, name: "Autres" }, baseMaps: bms });
    }
    return ordered;
  }, [baseMaps, listings]);

  return { baseMaps, groups };
}
