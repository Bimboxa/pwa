// Tab roles in the cross-tab sync model
// ----------------------------------------
//   Switch OFF ("Navigation indépendante") = LEADER → emits, does not receive
//   Switch ON  ("Navigation couplée")      = FOLLOWER → receives, does not emit
// Mutual exclusion: only one tab can be the FOLLOWER at a time. Activating
// the switch on a tab forces other followers back to leader.

export function getCurrentPathname() {
  return typeof window !== "undefined" ? window.location.pathname : "";
}

// Should this tab broadcast its synced actions?
// Leader (switch OFF) emits. The /dashboard URL is NOT excluded on emit:
// the leader navigating from /dashboard into a project/scope should
// propagate that transition to the follower.
export function shouldEmit(state) {
  return state?.layout?.coupledNavigationEnabled === false;
}

// Should this tab apply incoming broadcasts?
// Follower (switch ON) receives, but never while on /dashboard — being on
// the dashboard means the user is intentionally outside the editor and
// shouldn't be disturbed.
export function shouldReceive(state, pathname) {
  if (state?.layout?.coupledNavigationEnabled !== true) return false;
  if (pathname && pathname.startsWith("/dashboard")) return false;
  return true;
}

// Is this tab participating in the cross-tab editor group?
// Used for widest-tab toolbar coordination: any non-dashboard tab with a
// project/scope context counts, whether it is leader or follower.
export function isInSyncGroup(state, pathname) {
  if (pathname && pathname.startsWith("/dashboard")) return false;
  if (!state?.projects?.selectedProjectId) return false;
  if (!state?.scopes?.selectedScopeId) return false;
  return true;
}
