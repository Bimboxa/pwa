import { useSelector } from "react-redux";

import { selectModuleLabelsByKey } from "Features/scopeConfig/utils/scopeConfigSelectors";

import { DEFAULT_BUSINESS_OBJECT_TYPE_KEY } from "../data/businessObjectTypesCatalog";
import resolveBusinessObjectsModuleLabel from "../utils/resolveBusinessObjectsModuleLabel";

// Resolved label of the business-objects module of a type (default: the
// STANDARD "Ouvrages" module). Priority: per-scope override
// (scopeConfig.moduleLabelsByKey) > org appConfig string > type default.
export default function useBusinessObjectsModuleLabel(
  typeKey = DEFAULT_BUSINESS_OBJECT_TYPE_KEY
) {
  const moduleLabelsByKey = useSelector(selectModuleLabelsByKey);
  const appConfigLabelsByType = useSelector(
    (s) => s.appConfig.value?.strings?.modules?.businessObjectsByType
  );
  const appConfigLabel = useSelector(
    (s) => s.appConfig.value?.strings?.modules?.businessObjects
  );

  return resolveBusinessObjectsModuleLabel({
    typeKey,
    moduleLabelsByKey,
    appConfigLabel,
    appConfigLabelsByType,
  });
}
