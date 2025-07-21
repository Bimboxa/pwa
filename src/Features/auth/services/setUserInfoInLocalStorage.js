export default function setUserInfoInLocalStorage(userInfo) {
  const user_info = userInfo ? JSON.stringify(userInfo) : "";
  localStorage.setItem("user_info", user_info);
}
