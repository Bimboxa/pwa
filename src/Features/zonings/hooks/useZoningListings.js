import { useSelector } from "react-redux";

import useListings from "Features/listings/hooks/useListings";

export default function useZoningListings() {
  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // main

  const { value: listings } = useListings({
    filterByScopeId: scopeId,
    filterByEntityModelType: "ZONING",
  });

  // sort by rank (fractional indexing)

  const sorted = listings
    ? [...listings].sort((a, b) =>
        String(a.rank ?? "").localeCompare(String(b.rank ?? ""))
      )
    : listings;

  // result

  return sorted;
}
