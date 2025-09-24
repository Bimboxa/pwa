import { useMemo } from "react";
import { useSelector } from "react-redux";
import { getListingsSelector } from "../services/listingsSelectorCache";
import getObjectHash from "Features/misc/utils/getObjectHash";

export default function useListingsByScope(options) {
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const newOptions = {
    ...options,
    filterByScopeId: selectedScopeId,
  };

  const newOptionsHash = getObjectHash(newOptions);

  const selector = useMemo(
    () => getListingsSelector(newOptions),
    [newOptionsHash]
  );

  // main

  const listings = useSelector((s) => selector(s));

  return { value: listings, loading: false };
}
