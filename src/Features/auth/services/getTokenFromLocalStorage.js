export default function getTokenFromLocalStorage() {
  return localStorage.getItem("auth_token");
}
