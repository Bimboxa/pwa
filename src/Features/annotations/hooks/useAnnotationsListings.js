import { useSelector } from "react-redux";
import useListings from "Features/listings/hooks/useListings";

export default function useAnnotationsListings() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const listings = useListings({
    filterByProjectId: projectId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  return listings;
}
