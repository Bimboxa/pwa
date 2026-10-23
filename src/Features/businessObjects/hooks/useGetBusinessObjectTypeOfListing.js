import { useCallback } from "react";
import { useSelector } from "react-redux";

import { DEFAULT_BUSINESS_OBJECT_TYPE_KEY } from "../data/businessObjectTypesCatalog";
import resolveBusinessObjectType from "../utils/resolveBusinessObjectType";

// Resolver `(listing) => type` (strings resolved for the org) for the places
// reading the type of several listings or inside a callback — the hook form
// of utils/getBusinessObjectTypeOfListing. Listings written before the types
// existed (no businessObjectType) and unknown keys read as STANDARD.
export default function useGetBusinessObjectTypeOfListing() {
  const appConfigStringsByType = useSelector(
    (s) => s.appConfig.value?.strings?.businessObjectTypes
  );

  return useCallback(
    (listing) =>
      resolveBusinessObjectType({
        typeKey:
          listing?.businessObjectType ?? DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
        appConfigStringsByType,
      }),
    [appConfigStringsByType]
  );
}
