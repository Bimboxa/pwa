import exampleAppConfig from "App/Data/exampleAppConfig";

let appConfig = null;

const appConfigAsync = (async () => {
  if (!appConfig) {
    const appConfigS = localStorage.getItem("appConfig");
    if (appConfigS) {
      appConfig = JSON.parse(appConfigS);
    } else {
      appConfig = exampleAppConfig;
    }
  }
  return appConfig;
})();

export default appConfigAsync;
