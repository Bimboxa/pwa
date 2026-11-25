import {
  LAST_SCOPE_ID_BY_PROJECT_KEY,
  readLastScopeIdByProject,
} from "./getLastScopeIdByProject";

export default function setLastScopeIdForProject(projectId, scopeId) {
  if (projectId == null || !scopeId) return;
  const map = readLastScopeIdByProject();
  if (map[String(projectId)] === scopeId) return;
  map[String(projectId)] = scopeId;
  try {
    localStorage.setItem(LAST_SCOPE_ID_BY_PROJECT_KEY, JSON.stringify(map));
  } catch {
    // storage full / unavailable: the memory is a convenience only
  }
}
