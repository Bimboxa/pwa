/*
 * Refresh appConfig.
 * - use orgaAppConfigService
 * - fallback to default config
 */

import { useDispatch } from "react-redux";

import { setAppConfig } from "../appConfigSlice";

import fetchOrgaAppConfigService from "../services/fetchOrgaAppConfig";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";
import useToken from "Features/auth/hooks/useToken";

import resolveAppConfig from "../utils/resolveAppConfig";

import getAppConfigDefault from "../services/getAppConfigDefault";

export default function useRefreshAppConfig() {
  const dispatch = useDispatch();
  const accessToken = useToken();

  return async ({ configCode }) => {
    let appConfig;
    if (accessToken)
      appConfig = await fetchOrgaAppConfigService({ accessToken });
    if (!appConfig) appConfig = await getAppConfigDefault({ configCode });
    //
    appConfig = resolveAppConfig(appConfig);
    //
    console.log("debug_1607 appConfig", appConfig);
    //
    setAppConfigInLocalStorage(appConfig);
    dispatch(setAppConfig(appConfig));
  };
}
