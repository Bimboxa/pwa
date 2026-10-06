// Device-level preference: when true (the default), the dashboard exposes the
// full scope creation flow ("vide" / "pré-configuré" buttons + card selector).
// Off: single button + compact name/configuration dialog. Only an explicit
// stored "false" turns it off; a missing key keeps the default.
export default function getConfigurationsManagementFromLocalStorage() {
  const stored = localStorage.getItem("configurationsManagement");
  return stored === null ? true : stored === "true";
}
