import appConfigDefault from "./data/appConfigDefault";
import getAppConfigFromLocalStorage from "./services/getAppConfigFromLocalStorage";

let appConfig = null;

const appConfigAsync = (async () => {
  if (!appConfig) {
    appConfig = getAppConfigFromLocalStorage() || appConfigDefault;
  }
  return appConfig;
})();

export default appConfigAsync;
