export default function setAppConfigInLocalStorage(appConfig) {
  const appConfigS = appConfig ? JSON.stringify(appConfig) : null;
  localStorage.setItem("appConfig", appConfigS);
}
