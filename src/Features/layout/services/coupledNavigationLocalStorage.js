const LS_KEY = "coupledNavigationEnabled";

export function loadCoupledNavigationEnabled() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return true;
    return JSON.parse(raw) === true;
  } catch {
    return true;
  }
}

export function storeCoupledNavigationEnabled(enabled) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(Boolean(enabled)));
  } catch {
    // ignore quota / unavailable storage
  }
}
