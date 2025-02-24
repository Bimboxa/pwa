import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setServicesConfig, setServicesConfigQrCode} from "../settingsSlice";

import {loadServicesConfigFromLocalStorage} from "Features/settings/servicesLocalStorageSettings";

import QRCode from "qrcode";

export default function useInitServicesConfig() {
  const dispatch = useDispatch();

  async function loadServicesConfig() {
    const servicesConfig = loadServicesConfigFromLocalStorage();
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
