import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setAppConfig, setConfigCode, setDisable3D } from "../appConfigSlice";

import resolveAppConfig from "../utils/resolveAppConfig";

import getAppConfigDefault from "../services/getAppConfigDefault";
import getDisable3DFromLocalStorage from "../services/getDisable3DFromLocalStorage";

export default function useInitAppConfig() {
  const dispatch = useDispatch();

  // data

  //const configCode = useSelector((s) => s.appConfig.configCode);
  const configCode = import.meta.env.VITE_CONFIG_CODE;

  // helpers

  const initAsync = async () => {
    const appConfigDefault = await getAppConfigDefault({ configCode });
    const appConfig = await resolveAppConfig(appConfigDefault);

    console.log("debug_1802 setAppConfig", appConfig, configCode);
    dispatch(setAppConfig(appConfig));
    dispatch(setConfigCode(configCode));
  };

  useEffect(() => {
    dispatch(setDisable3D(getDisable3DFromLocalStorage()));
  }, []);

  useEffect(() => {
    console.log("debug_1802 useInitAppConfig", configCode);
    if (configCode) initAsync();
  }, [configCode]);
}
