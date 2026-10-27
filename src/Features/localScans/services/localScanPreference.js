const KEY = "krto.localScans.enabled.v1";

export function loadLocalScansEnabled() {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function storeLocalScansEnabled(enabled) {
  try {
    localStorage.setItem(KEY, String(enabled === true));
  } catch {
    // The preference still applies for the current session.
  }
}
