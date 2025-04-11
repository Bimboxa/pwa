import {useState, useEffect} from "react";
import appConfigAsync from "../appConfigAsync";

export default function useAppConfig() {
  const [appConfig, setAppConfig] = useState(null);

  async function getAppConfig() {
    const appConfig = await appConfigAsync;
    setAppConfig(appConfig);
  }
  useEffect(() => {
    console.log("[EFFECT] getAppConfig");
    getAppConfig();
  }, []);

  return appConfig;
}
