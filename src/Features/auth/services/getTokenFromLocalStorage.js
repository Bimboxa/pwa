export default function getTokenFromLocalStorage() {
  return localStorage.get("auth_token");
}
