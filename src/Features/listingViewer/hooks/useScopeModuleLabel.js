import { useSelector } from "react-redux";

import { selectModuleLabelsByKey } from "Features/scopeConfig/utils/scopeConfigSelectors";

import resolveScopeModuleLabel from "../utils/resolveScopeModuleLabel";

// Resolved label of the SCOPE module. Priority: per-scope override
// (scopeConfig.moduleLabelsByKey) > org appConfig strings.scope.nameSingular >
// hardcoded default.
export default function useScopeModuleLabel() {
  const moduleLabelsByKey = useSelector(selectModuleLabelsByKey);
  const appConfigScopeName = useSelector(
    (s) => s.appConfig.value?.strings?.scope?.nameSingular
  );

  return resolveScopeModuleLabel({ moduleLabelsByKey, appConfigScopeName });
}
