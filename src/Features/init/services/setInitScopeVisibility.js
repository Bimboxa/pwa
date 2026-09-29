import getInitScopeVisibility, {
  getScopeVisibilityStorageKey,
} from "./getInitScopeVisibility";

// Merges `patch` (any subset of the keys of getInitScopeVisibility) into the
// saved settings of the scope. No-op without a scopeId.
export default function setInitScopeVisibility(scopeId, patch) {
  if (!scopeId || !patch) return;
  try {
    const current = getInitScopeVisibility(scopeId) ?? {};
    localStorage.setItem(
      getScopeVisibilityStorageKey(scopeId),
      JSON.stringify({ ...current, ...patch })
    );
  } catch {
    // localStorage unavailable (private mode, quota): the settings simply
    // don't survive the reload.
  }
}
