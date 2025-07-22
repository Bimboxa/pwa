export default function logoutService() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user_info");
}
