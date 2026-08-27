import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import getTitleBlockManifest from "../utils/getTitleBlockManifest";

// Title block manifest for a portfolio (pass null for the org default,
// e.g. in creation dialogs where no portfolio exists yet).
export default function useTitleBlockManifest(portfolio) {
  const appConfig = useAppConfig();
  return getTitleBlockManifest(appConfig, portfolio);
}
