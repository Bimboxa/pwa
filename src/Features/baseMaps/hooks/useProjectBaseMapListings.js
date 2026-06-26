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

  // sort by rank (fractional indexing) when available, else alphabetically by name

  const hasRank = listings?.some((l) => l.rank != null);

  const sorted = listings
    ? [...listings].sort((a, b) => {
        if (hasRank) {
          return String(a.rank ?? "").localeCompare(String(b.rank ?? ""));
        }
        return (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        });
      })
    : listings;

  // result

  return sorted;
}
