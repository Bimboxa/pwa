export default function getHideWarningFromLocalStorage() {
  const warningS = localStorage.getItem("hideWarning");
  return warningS === "true";
}
