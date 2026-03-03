import { useMemo } from "react";

import useListingById from "Features/listings/hooks/useListingById";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

export default function useMainBaseMapListing(options) {
  const baseMap = useMainBaseMap();

  const listing = useListingById(baseMap?.listingId, {
    withFiles: options?.withFiles,
  });

  return useMemo(() => {
    if (!listing) return undefined;
    return { ...listing, table: "baseMaps" };
  }, [listing]);
}
