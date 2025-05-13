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
  const debug = email === "favreau-consulting@lei.fr";

  const forceUpdateAt = useSelector((s) => s.appConfig.forceUpdateAt);

  const initAsync = async () => {
    let appConfig;

    // 1st : get appConfig from localStorage
    appConfig = getAppConfigFromLocalStorage();

    // Fallback : fetch appConfig from server & resolve it
    if (!appConfig && accessToken) {
      appConfig = await fetchOrgaInitAppConfigService({accessToken});
      appConfig = resolveAppConfig(appConfig, {debug});

      // fallback to default confit
      if (!appConfig) appConfig = resolveAppConfig(appConfigDefault);

      // store
      setAppConfigInLocalStorage(appConfig);
    }

    console.log("[debug] setAppConfig", appConfig);
    dispatch(setAppConfig(appConfig));
  };

  useEffect(() => {
    initAsync();
  }, [accessToken, forceUpdateAt]);
}
