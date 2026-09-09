import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import createBusinessObjectListingService from "../services/createBusinessObjectListingService";
import selectSelectedBusinessObjectTypeKey from "../utils/selectSelectedBusinessObjectTypeKey";
import { DEFAULT_BUSINESS_OBJECT_TYPE_KEY } from "../data/businessObjectTypesCatalog";

// Creates a business-object listing in the selected scope. The listing type
// defaults to the type of the selected business-objects module (the panel's
// "Nouvelle liste" is the only caller), STANDARD outside those modules.
export default function useCreateBusinessObjectListing() {
  const appConfig = useAppConfig();

  const _projectId = useSelector((s) => s.projects.selectedProjectId);
  const _scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const selectedTypeKey = useSelector(selectSelectedBusinessObjectTypeKey);

  const create = async ({
    projectId,
    scopeId,
    name,
    typeKey,
    canLocateBusinessObjects,
  } = {}) => {
    return createBusinessObjectListingService({
      projectId: projectId ?? _projectId,
      scopeId: scopeId ?? _scopeId,
      name,
      typeKey: typeKey ?? selectedTypeKey ?? DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
      canLocateBusinessObjects,
      appConfig,
    });
  };

  return create;
}
