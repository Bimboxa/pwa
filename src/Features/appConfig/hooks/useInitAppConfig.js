import {useEffect} from "react";

import {useDispatch, useSelector} from "react-redux";

import {setAppConfig} from "../appConfigSlice";

import getAppConfigFromLocalStorage from "../services/getAppConfigFromLocalStorage";
import fetchOrgaInitAppConfigService from "../services/fetchOrgaInitAppConfig";

import appConfigDefault from "../data/appConfigDefault";

import useToken from "Features/auth/hooks/useToken";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";
import resolveAppConfig from "../utils/resolveAppConfig";

import {useUser} from "@clerk/clerk-react";
import {LensOutlined} from "@mui/icons-material";

export default function useInitAppConfig() {
  const dispatch = useDispatch();
  const accessToken = useToken();

  // user for debug mode
  const {user} = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  let debug = email === "favreau-consulting@lei.fr";
  debug = false;

  const forceUpdateAt = useSelector((s) => s.appConfig.forceUpdateAt);
  const useDefault = useSelector((s) => s.appConfig.useDefault);

  const initAsync = async () => {
    let appConfig;

    // 1st : get appConfig from localStorage
    appConfig = getAppConfigFromLocalStorage();

    if (useDefault) {
      appConfig = resolveAppConfig(appConfigDefault);
      setAppConfigInLocalStorage(appConfig);
    } else if (!appConfig && accessToken) {
      // Fallback : fetch appConfig from server & resolve it

      appConfig = await fetchOrgaInitAppConfigService({accessToken});
      appConfig = resolveAppConfig(appConfig, {debug});

      // fallback to default confit
      if (!appConfig) appConfig = resolveAppConfig(appConfigDefault);

      // store
      setAppConfigInLocalStorage(appConfig);
    }

    // resolve with localData
    if (appConfig) appConfig = resolveAppConfig(appConfig); // to update when remoteContainerPath change

    console.log("[debug] setAppConfig", appConfig);
    dispatch(setAppConfig(appConfig));
  };

  useEffect(() => {
    initAsync();
  }, [accessToken, forceUpdateAt]);
}
