export default function setTokenInLocalStorage(token) {
  if (token) localStorage.setItem("auth_token", token);
}
