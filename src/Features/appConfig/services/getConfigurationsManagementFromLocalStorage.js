// Device-level preference: when true, the dashboard exposes the full scope
// creation flow ("vide" / "pré-configuré" buttons + card selector). Off by
// default: single button + compact name/configuration dialog.
export default function getConfigurationsManagementFromLocalStorage() {
  return localStorage.getItem("configurationsManagement") === "true";
}
