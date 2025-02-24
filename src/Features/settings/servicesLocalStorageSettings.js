export function storeServicesConfigInLocalStorage(settings) {
  localStorage.setItem("servicesConfig", JSON.stringify(settings));
}

export function loadServicesConfigFromLocalStorage() {
  const settings = localStorage.getItem("servicesConfig");
  return settings ? JSON.parse(settings) : null;
}
