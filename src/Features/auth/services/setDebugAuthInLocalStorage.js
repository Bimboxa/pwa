export default function setDebugAuthInLocalStorage(debugAuth) {
  if (debugAuth) localStorage.setItem("debug_auth", JSON.stringify(debugAuth));
}
