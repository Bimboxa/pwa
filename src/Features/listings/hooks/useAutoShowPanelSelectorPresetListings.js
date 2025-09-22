import { useSelector } from "react-redux";

import useListings from "./useListings";

export default function useAutoShowPanelSelectorPresetListings() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const listings = useListings({
    filterByProjectId: projectId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  console.log("listings", listings);

  return !listings?.length > 0;
}
