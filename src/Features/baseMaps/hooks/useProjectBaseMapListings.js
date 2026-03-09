import { useSelector } from "react-redux";
import useListings from "Features/listings/hooks/useListings";

export default function useProjectBaseMapListings(options) {

  // options

  const projectId = options?.projectId;

  // data

  const _projectId = useSelector((s) => s.projects.selectedProjectId);

  // main

  const {value: listings} = useListings({
    filterByProjectId: projectId ?? _projectId,
    filterByEntityModelType: "BASE_MAP",
  });

  // sort alphabetically by name

  const sorted = listings
    ? [...listings].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        })
      )
    : listings;

  // result

  return sorted;
}
