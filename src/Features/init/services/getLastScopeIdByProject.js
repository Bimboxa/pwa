// Last opened scope per project ({[projectId]: scopeId}), persisted in
// localStorage. Used to re-select a scope when a project is entered without a
// valid one (see useEnsureSelectedScope).
export const LAST_SCOPE_ID_BY_PROJECT_KEY = "lastScopeIdByProjectId";

export function readLastScopeIdByProject() {
  try {
    const raw = localStorage.getItem(LAST_SCOPE_ID_BY_PROJECT_KEY);
    const map = raw ? JSON.parse(raw) : null;
    return map && typeof map === "object" ? map : {};
  } catch {
    return {};
  }
}

export default function getLastScopeIdByProject(projectId) {
  if (projectId == null) return null;
  return readLastScopeIdByProject()[String(projectId)] ?? null;
}
