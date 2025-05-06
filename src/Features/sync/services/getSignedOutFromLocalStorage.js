export default function getSignedOutFromLocalStorage() {
  const valueS = localStorage.getItem("signedOut");
  return valueS === "true";
}
