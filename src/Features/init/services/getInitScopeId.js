export default function getInitScopeId() {
  const initScopeId = localStorage.getItem("initScopeId");

  if (initScopeId === "null") return null;

  return initScopeId;
}
