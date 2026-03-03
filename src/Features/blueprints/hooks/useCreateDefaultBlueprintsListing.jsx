import { useSelector } from "react-redux";

import useCreateListings from "Features/listings/hooks/useCreateListings";
import useDefaultBlueprintsListingProps from "./useDefaultBlueprintsListingProps";

export default function useCreateDefaultBlueprintsListing() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const props = useDefaultBlueprintsListingProps();

  const createListings = useCreateListings();

  return async (options) => {
    // options

    const _projectId = options?.projectId;

    // main

    const listing = { projectId: _projectId ?? projectId, scopeId, ...props };
    const [created] = await createListings({ listings: [listing] });
    return created;
  };
}
