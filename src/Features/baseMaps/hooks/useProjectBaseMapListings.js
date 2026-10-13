import { useSelector } from "react-redux";
import useListings from "Features/listings/hooks/useListings";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";

export default function useProjectBaseMapListings(options) {

  // options

  const projectId = options?.projectId;
  // Folders hidden in the selected scope (eye of the SCOPE module) are left
  // out by default: they do not exist for the scope. The scope creation recap
  // opts in — its eyes are what defines the hidden folders.
  const includeDisabled = options?.includeDisabled ?? false;

  // data

  const _projectId = useSelector((s) => s.projects.selectedProjectId);
  const { disabledListingIds } = useDisabledBaseMapListingIds();

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

  const result =
    !includeDisabled && disabledListingIds.length > 0
      ? sorted?.filter((l) => !disabledListingIds.includes(l.id))
      : sorted;

  return result;
}
