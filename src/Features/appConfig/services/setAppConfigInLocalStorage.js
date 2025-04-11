export default function setAppConfigInLocalStorage(appConfig) {
  try {
    const appConfigS = appConfig ? JSON.stringify(appConfig) : null;
    console.log("[setAppConfigInLocalStorage]", appConfig);
    localStorage.setItem("appConfig", appConfigS);
  } catch (e) {
    console.log("error", e);
  }
}
