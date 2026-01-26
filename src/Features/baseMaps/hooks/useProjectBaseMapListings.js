import { useSelector } from "react-redux";
import useListings from "Features/listings/hooks/useListings";

export default function useProjectBaseMapListings(options) {

  // options

  const projectId = options?.projectId;

  // data

  const _projectId = useSelector((s) => s.projects.selectedProjectId);

  // main

  const listings = useListings({
    filterByProjectId: projectId ?? _projectId,
    filterByEntityModelType: "BASE_MAP",
  });

  // result

  return listings;
}
