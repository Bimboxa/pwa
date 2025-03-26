export default function getInitProjectId() {
  const initProjectId = localStorage.getItem("initProjectId");

  return initProjectId;
}
