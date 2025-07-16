export default function getIsOnboardedFromLocalStorage() {
  return localStorage.getItem("isOnboarded") === "true";
}
