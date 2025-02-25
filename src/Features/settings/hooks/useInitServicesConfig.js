import {useEffect} from "react";

import {useDispatch, useSelector} from "react-redux";

import {setServicesConfig, setServicesConfigQrCode} from "../settingsSlice";

import {loadServicesConfigFromLocalStorage} from "Features/settings/servicesLocalStorageSettings";

import QRCode from "qrcode";

export default function useInitServicesConfig() {
  const dispatch = useDispatch();

  // data

  const stateServicesConfig = useSelector((s) => s.settings.servicesConfig);

  // helper

  const fromInitialState = stateServicesConfig.fromInitialState;

  async function loadServicesConfig() {
    let servicesConfig = loadServicesConfigFromLocalStorage();
    if (fromInitialState)
      servicesConfig = {
        ...stateServicesConfig,
        ...servicesConfig,
        fromInitialState: false,
      };
    const servicesConfigS = servicesConfig
      ? JSON.stringify(servicesConfig)
      : null;

    if (servicesConfig) {
      const servicesConfigQrCode = await QRCode.toDataURL(servicesConfigS);
      dispatch(setServicesConfig(servicesConfig));
      dispatch(setServicesConfigQrCode(servicesConfigQrCode));
    }
  }

  useEffect(() => {
    loadServicesConfig();
  }, []);
}
