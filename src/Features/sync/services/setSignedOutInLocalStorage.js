export default function setSignedOutInLocalStorage(value) {
  const valueS = value ? "true" : "false";
  localStorage.setItem("signedOut", valueS);
}
