import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import logoEdx from "Features/appConfig/assets/logo_edx.png";

export default function useOrgaLogoUrl() {
  const appConfig = useAppConfig();

  if (appConfig?.orgaCode === "edx") {
    return logoEdx;
  }

  return null;
}
