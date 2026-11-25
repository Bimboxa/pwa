export default function setInitScopeId(initScopeId) {
  // A nullish id must not be stored as the string "undefined" / "null": it
  // would be restored as a truthy scope id at the next boot.
  if (initScopeId == null) {
    localStorage.removeItem("initScopeId");
    return;
  }
  localStorage.setItem("initScopeId", initScopeId);
}
