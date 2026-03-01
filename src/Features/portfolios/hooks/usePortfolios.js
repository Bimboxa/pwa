import { useMemo } from "react";

import useListings from "Features/listings/hooks/useListings";

export default function usePortfolios(options) {
  const scopeId = options?.filterByScopeId;

  const { value: listings } = useListings({
    filterByScopeId: scopeId,
    filterByEntityModelType: "PORTFOLIO_PAGE",
    withFiles: options?.withFiles,
  });

  const sorted = useMemo(() => {
    if (!listings?.length) return listings;
    return [...listings].sort((a, b) => {
      if (a.sortIndex == null && b.sortIndex == null) return 0;
      if (a.sortIndex == null) return -1;
      if (b.sortIndex == null) return 1;
      return a.sortIndex < b.sortIndex ? -1 : 1;
    });
  }, [listings]);

  return { value: sorted };
}
