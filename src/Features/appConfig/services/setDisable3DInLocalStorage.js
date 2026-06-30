export default function setDisable3DInLocalStorage(disable3D) {
  localStorage.setItem("disable3D", disable3D ? "true" : "false");
}
