import appConfigDefault from "./data/appConfigDefault";

let appConfig = null;

const appConfigAsync = (async () => {
  if (!appConfig) {
    const appConfigS = localStorage.getItem("appConfig");
    if (appConfigS) {
      appConfig = JSON.parse(appConfigS);
    } else {
      appConfig = appConfigDefault;
    }
  }
  return appConfig;
})();

export default appConfigAsync;
