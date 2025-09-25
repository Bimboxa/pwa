import { useSelector } from "react-redux";

import useCreateListing from "Features/listings/hooks/useCreateListing";
import useDefaultBlueprintsListingProps from "./useDefaultBlueprintsListingProps";

export default function useCreateDefaultBlueprintsListing() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const props = useDefaultBlueprintsListingProps();

  const createListing = useCreateListing();

  return async () => {
    const listing = { projectId, scopeId, ...props };
    return await createListing({ listing });
  };
}
