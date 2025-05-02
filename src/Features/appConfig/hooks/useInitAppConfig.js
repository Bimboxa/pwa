import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setAppConfig} from "../appConfigSlice";

import getAppConfigFromLocalStorage from "../services/getAppConfigFromLocalStorage";
import fetchOrgaInitAppConfigService from "../services/fetchOrgaInitAppConfig";
import appConfigDefault from "../data/appConfigDefault";

import useToken from "Features/auth/hooks/useToken";

export default function useInitAppConfig() {
  const dispatch = useDispatch();
  const accessToken = useToken();

  const initAsync = async () => {
    let appConfig;

    // 1st : get appConfig from localStorage
    appConfig = getAppConfigFromLocalStorage();

    // Fallback : fetch appConfig from server
    if (!appConfig && accessToken) {
      appConfig = await fetchOrgaInitAppConfigService({accessToken});
    }

    dispatch(setAppConfig(appConfig));
  };

  useEffect(() => {
    initAsync();
  }, [accessToken]);
}
