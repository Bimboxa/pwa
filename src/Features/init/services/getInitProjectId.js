export default function getInitProjectId() {
  const initProjectId = localStorage.getItem("initProjectId");

  if (initProjectId === "null") return null;

  return initProjectId;
}
