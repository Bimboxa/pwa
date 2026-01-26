export default function getDebugAuthFromLocalStorage() {
  const debugAuth = localStorage.getItem("debug_auth");
  if (debugAuth === "null") return null;
  return JSON.parse(debugAuth);
}
