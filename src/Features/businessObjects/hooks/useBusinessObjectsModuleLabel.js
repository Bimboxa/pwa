import { useSelector } from "react-redux";

import { selectModuleLabelsByKey } from "Features/scopeConfig/utils/scopeConfigSelectors";

// Resolved label of the BUSINESS_OBJECTS module. Priority: per-scope override
// (scopeConfig.moduleLabelsByKey) > org appConfig string > hardcoded default.
export default function useBusinessObjectsModuleLabel() {
  const moduleLabelsByKey = useSelector(selectModuleLabelsByKey);
  const appConfigLabel = useSelector(
    (s) => s.appConfig.value?.strings?.modules?.businessObjects
  );

  return (
    moduleLabelsByKey.BUSINESS_OBJECTS?.trim() || appConfigLabel || "Ouvrages"
  );
}
