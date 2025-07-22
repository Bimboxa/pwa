export default function getTokenFromLocalStorage() {
  const token = localStorage.getItem("auth_token");
  if (token === "null") return null;
  return token;
}
