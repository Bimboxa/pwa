import { useSelector } from "react-redux";

import useCreateListing from "Features/listings/hooks/useCreateListing";
import useDefaultBlueprintsListingProps from "./useDefaultBlueprintsListingProps";

export default function useCreateDefaultBlueprintsListing() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const props = useDefaultBlueprintsListingProps();

  const createListing = useCreateListing();

  return async () => {
    const listing = { projectId, ...props };
    return await createListing({ listing });
  };
}
