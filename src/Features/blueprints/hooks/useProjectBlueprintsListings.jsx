import { useSelector } from "react-redux";
import useListings from "Features/listings/hooks/useListings";

export default function useProjectBlueprintsListings() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listings = useListings({
    filterByProjectId: projectId,
    filterByEntityModelType: "BLUEPRINT",
  });

  return listings;
}
