import { useSelector } from "react-redux";
import useListings from "Features/listings/hooks/useListings";

export default function useProjectBaseMapListings() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // main

  const listings = useListings({
    filterByProjectId: projectId,
    filterByEntityModelType: "BASE_MAP",
  });

  // result

  return listings;
}
