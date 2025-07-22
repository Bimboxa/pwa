export default function getUserInfoFromLocalStorage() {
  const user_info = localStorage.getItem("user_info");
  if (user_info?.length > 0) return JSON.parse(user_info);
}
