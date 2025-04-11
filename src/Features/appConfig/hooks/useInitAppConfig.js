import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setAppConfig} from "../appConfigSlice";

import getAppConfigFromLocalStorage from "../services/getAppConfigFromLocalStorage";
import appConfigDefault from "../data/appConfigDefault";

export default function useInitAppConfig() {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log("[EFFECT] initAppConfig");
    const appConfig = getAppConfigFromLocalStorage() || appConfigDefault;
    dispatch(setAppConfig(appConfig));
  }, []);
}
