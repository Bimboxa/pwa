export default function setHideWarningInLocalStorage(boolean) {
  const warning = boolean ? "true" : "false";
  localStorage.setItem("hideWarning", warning);
}
