export default function getAppConfigFromLocalStorage() {
  const appConfigS = localStorage.getItem("appConfig");

  if (appConfigS) {
    return JSON.parse(appConfigS);
  } else {
    return null;
  }
}
