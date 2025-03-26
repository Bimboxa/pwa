export default function getInitScopeId() {
  const initScopeId = localStorage.getItem("initScopeId");

  return initScopeId;
}
