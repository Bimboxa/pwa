import { useSelector } from "react-redux";

import useListings from "./useListings";

export default function useAutoShowPanelSelectorPresetListings() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const listings = useListings({
    filterByProjectId: projectId,
    filterByEntityModelType: "LOCATED_ENTITY",
    //filterByScopeId: scopeId,
  });

  console.log("debug_2509_listings", listings, scopeId);

  return !listings?.length > 0;
}
