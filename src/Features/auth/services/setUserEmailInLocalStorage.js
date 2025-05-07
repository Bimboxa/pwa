export default function setUserEmailInLocalStorage(value) {
  const email = value?.includes("@") ? value : null;
  localStorage.setItem("userEmail", email);
}
