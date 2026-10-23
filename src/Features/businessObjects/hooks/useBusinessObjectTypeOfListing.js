import { useMemo } from "react";

import useGetBusinessObjectTypeOfListing from "./useGetBusinessObjectTypeOfListing";

// Type entry (strings resolved for the org + features) of one business
// object listing — see useGetBusinessObjectTypeOfListing.
export default function useBusinessObjectTypeOfListing(listing) {
  const getTypeOfListing = useGetBusinessObjectTypeOfListing();
  const typeKey = listing?.businessObjectType;

  return useMemo(
    () => getTypeOfListing({ businessObjectType: typeKey }),
    [getTypeOfListing, typeKey]
  );
}
