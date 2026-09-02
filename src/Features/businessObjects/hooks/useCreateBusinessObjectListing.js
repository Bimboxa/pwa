import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import createBusinessObjectListingService from "../services/createBusinessObjectListingService";

export default function useCreateBusinessObjectListing() {
  const appConfig = useAppConfig();

  const _projectId = useSelector((s) => s.projects.selectedProjectId);
  const _scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const create = async ({ projectId, scopeId, name } = {}) => {
    return createBusinessObjectListingService({
      projectId: projectId ?? _projectId,
      scopeId: scopeId ?? _scopeId,
      name,
      appConfig,
    });
  };

  return create;
}
