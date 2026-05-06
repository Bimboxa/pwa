// True when cross-tab sync should be active for this tab.
// The user's switch preference is the master flag, but we also force-disable
// when there is no project/scope selected or when the user is on /dashboard,
// since broadcasting in those states would either be meaningless or surprising.
export function isEffectivelyCoupled(state, pathname) {
  if (!state?.layout?.coupledNavigationEnabled) return false;
  if (!state?.projects?.selectedProjectId) return false;
  if (!state?.scopes?.selectedScopeId) return false;
  if (pathname && pathname.startsWith("/dashboard")) return false;
  return true;
}

export function getCurrentPathname() {
  return typeof window !== "undefined" ? window.location.pathname : "";
}
