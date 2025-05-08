import {useEffect} from "react";

import {useDispatch, useSelector} from "react-redux";

import {setAppConfig} from "../appConfigSlice";

import getAppConfigFromLocalStorage from "../services/getAppConfigFromLocalStorage";
import fetchOrgaInitAppConfigService from "../services/fetchOrgaInitAppConfig";

import appConfigDefault from "../data/appConfigDefault";

import useToken from "Features/auth/hooks/useToken";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";

export default function useInitAppConfig() {
  const dispatch = useDispatch();
  const accessToken = useToken();

  const forceUpdateAt = useSelector((s) => s.appConfig.forceUpdateAt);

  const initAsync = async () => {
    let appConfig;

    // 1st : get appConfig from localStorage
    appConfig = getAppConfigFromLocalStorage();

    // Fallback : fetch appConfig from server
    if (!appConfig && accessToken) {
      appConfig = await fetchOrgaInitAppConfigService({accessToken});

      // fallback to default confit
      if (!appConfig) appConfig = appConfigDefault;
      setAppConfigInLocalStorage(appConfig);
    }

    dispatch(setAppConfig(appConfig));
  };

  useEffect(() => {
    initAsync();
  }, [accessToken, forceUpdateAt]);
}
