export default function getDisable3DFromLocalStorage() {
  return localStorage.getItem("disable3D") === "true";
}
