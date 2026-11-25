export default function getInitScopeId() {
  const initScopeId = localStorage.getItem("initScopeId");

  if (!initScopeId || initScopeId === "null" || initScopeId === "undefined")
    return null;

  return initScopeId;
}
