export default function setUserProfileInLocalStorage(userProfile) {
  const user_info = userProfile ? JSON.stringify(userProfile) : "";
  localStorage.setItem("user_info", user_info);
}
