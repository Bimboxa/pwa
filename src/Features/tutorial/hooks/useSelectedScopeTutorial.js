import { useSelector } from "react-redux";

import {
  selectSelectedScopeConfiguration,
  selectSelectedScopeTutorial,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

// Tutorial of the selected scope's Krto configuration, resolved by
// resolveAppConfig from Data/<org>/configurations/tutorials/<key>.md.
// `tutorial` is null when the scope has no configuration or the configuration
// has no tutorial file (the TUTORIAL tool is then hidden).
export default function useSelectedScopeTutorial() {
  const tutorial = useSelector(selectSelectedScopeTutorial);
  const configuration = useSelector(selectSelectedScopeConfiguration);
  const orgaCode = useSelector((s) => s.appConfig.value?.orgaCode);

  return { tutorial, configuration, orgaCode };
}
