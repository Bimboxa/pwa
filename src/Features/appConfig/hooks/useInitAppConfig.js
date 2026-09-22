import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setAppConfig,
  setConfigCode,
  setDisable3D,
  setConfigurationsManagement,
  setSatelliteCaptureMode,
  setDefaultModuleKey,
  setChatConnection,
} from "../appConfigSlice";

import resolveAppConfig from "../utils/resolveAppConfig";

import getAppConfigDefault from "../services/getAppConfigDefault";
import getDisable3DFromLocalStorage from "../services/getDisable3DFromLocalStorage";
import getConfigurationsManagementFromLocalStorage from "../services/getConfigurationsManagementFromLocalStorage";
import getSatelliteCaptureModeFromLocalStorage from "../services/getSatelliteCaptureModeFromLocalStorage";
import getDefaultModuleKeyFromLocalStorage from "../services/getDefaultModuleKeyFromLocalStorage";
import getChatConnectionFromLocalStorage from "../services/getChatConnectionFromLocalStorage";

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
    dispatch(
      setConfigurationsManagement(getConfigurationsManagementFromLocalStorage())
    );
    dispatch(
      setSatelliteCaptureMode(getSatelliteCaptureModeFromLocalStorage())
    );
    dispatch(setDefaultModuleKey(getDefaultModuleKeyFromLocalStorage()));
    dispatch(setChatConnection(getChatConnectionFromLocalStorage()));
  }, []);

  useEffect(() => {
    console.log("debug_1802 useInitAppConfig", configCode);
    if (configCode) initAsync();
  }, [configCode]);
}
