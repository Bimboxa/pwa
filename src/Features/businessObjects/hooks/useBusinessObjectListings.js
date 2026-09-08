import { useSelector } from "react-redux";

import useListings from "Features/listings/hooks/useListings";

import { DEFAULT_BUSINESS_OBJECT_TYPE_KEY } from "../data/businessObjectTypesCatalog";

// Business-object listings of the selected scope, sorted by rank. `typeKey`
// restricts them to one business object type (a listing without the field —
// created before the types existed — reads as STANDARD); omitted => every
// type.
export default function useBusinessObjectListings({ typeKey } = {}) {
  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // main

  const { value: listings } = useListings({
    filterByScopeId: scopeId,
    filterByEntityModelType: "BUSINESS_OBJECT",
  });

  // filter by type (read-time fallback, no backfill)

  const filtered =
    listings && typeKey
      ? listings.filter(
          (l) =>
            (l.businessObjectType ?? DEFAULT_BUSINESS_OBJECT_TYPE_KEY) ===
            typeKey
        )
      : listings;

  // sort by rank (fractional indexing)

  const sorted = filtered
    ? [...filtered].sort((a, b) =>
        String(a.rank ?? "").localeCompare(String(b.rank ?? ""))
      )
    : listings;

  // result

  return sorted;
}
