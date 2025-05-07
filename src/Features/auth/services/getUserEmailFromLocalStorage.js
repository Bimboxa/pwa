export default function getUserEmailFromLocalStorage() {
  const email = localStorage.getItem("userEmail");
  if (email?.includes("@")) {
    return email;
  } else {
    return null;
  }
}
