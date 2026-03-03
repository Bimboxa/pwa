import { useSelector } from "react-redux";
import useListings from "./useListings";

export default function useListingsByScope(options) {
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  return useListings({ ...options, filterByScopeId: selectedScopeId });
}
