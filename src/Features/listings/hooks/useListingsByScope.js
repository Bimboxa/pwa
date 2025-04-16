import {useMemo} from "react";
import {useSelector} from "react-redux";
import {getListingsSelector} from "../services/listingsSelectorCache";

export default function useListingsByScope(options) {
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const newOptions = {...options, filterByScopeId: selectedScopeId};
  const selector = useMemo(() => getListingsSelector(newOptions), [newOptions]);

  // main

  const listings = useSelector((s) => selector(s));

  return {value: listings, loading: false};
}
