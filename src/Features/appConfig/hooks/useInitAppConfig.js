import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setAppConfig, setConfigCode } from "../appConfigSlice";

import resolveAppConfig from "../utils/resolveAppConfig";

import getAppConfigDefault from "../services/getAppConfigDefault";

export default function useInitAppConfig() {
  const dispatch = useDispatch();

  // data

  //const configCode = useSelector((s) => s.appConfig.configCode);
  const configCode = import.meta.env.VITE_CONFIG_CODE;

  // helpers

  const initAsync = async () => {
    const appConfigDefault = await getAppConfigDefault({ configCode });
    const appConfig = await resolveAppConfig(appConfigDefault);

    console.log("[debug] setAppConfig", appConfigDefault, appConfig, configCode);
    dispatch(setAppConfig(appConfig));
    dispatch(setConfigCode(configCode));
  };

  useEffect(() => {
    if (configCode) initAsync();
  }, [configCode]);
}
