import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setAppConfig } from "../appConfigSlice";

import resolveAppConfig from "../utils/resolveAppConfig";

import getAppConfigDefault from "../services/getAppConfigDefault";

export default function useInitAppConfig() {
  const dispatch = useDispatch();

  // data

  const configCode = useSelector((s) => s.appConfig.configCode);

  // helpers

  const initAsync = async () => {
    const appConfigDefault = await getAppConfigDefault({ configCode });
    const appConfig = await resolveAppConfig(appConfigDefault);

    console.log("[debug] setAppConfig", appConfig, configCode);
    dispatch(setAppConfig(appConfig));
  };

  useEffect(() => {
    if (configCode) initAsync();
  }, [configCode]);
}
