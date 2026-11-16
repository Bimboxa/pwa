export default function getInitScopeOpeningSource() {
  try {
    const value = JSON.parse(localStorage.getItem("initScopeOpeningSource"));
    return value?.scopeId && value?.projectId ? value : null;
  } catch {
    return null;
  }
}
