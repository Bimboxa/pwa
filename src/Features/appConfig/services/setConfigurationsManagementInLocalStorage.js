export default function setConfigurationsManagementInLocalStorage(enabled) {
  localStorage.setItem("configurationsManagement", enabled ? "true" : "false");
}
