import { useMemo } from "react";
import { useSelector } from "react-redux";

import useBusinessObjects from "./useBusinessObjects";

// Objects count of every business-object listing of the selected scope,
// keyed by listingId — one live query for the scope (not one per listing),
// for the count pills of the listings panel.
export default function useBusinessObjectCountsByListingId() {
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: businessObjects } = useBusinessObjects({ scopeId });

  return useMemo(() => {
    const counts = {};
    (businessObjects ?? []).forEach((o) => {
      if (!o.listingId) return;
      counts[o.listingId] = (counts[o.listingId] ?? 0) + 1;
    });
    return counts;
  }, [businessObjects]);
}
