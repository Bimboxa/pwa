import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setAppConfig } from "../appConfigSlice";

import getAppConfigFromLocalStorage from "../services/getAppConfigFromLocalStorage";
import fetchOrgaAppConfigService from "../services/fetchOrgaAppConfig";

import useToken from "Features/auth/hooks/useToken";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";
import resolveAppConfig from "../utils/resolveAppConfig";

import getAppConfigDefault from "../services/getAppConfigDefault";

export default function useInitAppConfig() {
  const dispatch = useDispatch();
  const accessToken = useToken();

  // data

  const forceUpdateAt = useSelector((s) => s.appConfig.forceUpdateAt);
  const useDefault = useSelector((s) => s.appConfig.useDefault);

  // helpers

  const initAsync = async () => {
    let appConfig;
    const appConfigDefault = await getAppConfigDefault();

    // 1st : get appConfig from localStorage
    appConfig = getAppConfigFromLocalStorage();

    if (useDefault) {
      appConfig = resolveAppConfig(appConfigDefault);
      setAppConfigInLocalStorage(appConfig);
    } else if (!appConfig && accessToken) {
      // Fallback : fetch appConfig from server & resolve it

      appConfig = await fetchOrgaAppConfigService({ accessToken });
      appConfig = resolveAppConfig(appConfig);
    }

    // fallback to default config
    if (!appConfig) appConfig = resolveAppConfig(appConfigDefault);

    // store
    setAppConfigInLocalStorage(appConfig);

    // resolve with localData
    if (appConfig) appConfig = resolveAppConfig(appConfig); // to update when remoteContainerPath change

    console.log("[debug] setAppConfig", appConfig);
    dispatch(setAppConfig(appConfig));
  };

  useEffect(() => {
    initAsync();
  }, [accessToken, forceUpdateAt]);
}
