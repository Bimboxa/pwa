export default function getInitProjectId() {
  const initProjectId = localStorage.getItem("initProjectId");

  // Si l'item n'existe pas (null object) ou vaut la string "null"
  if (initProjectId === null || initProjectId === "null") return null;

  // Vérifie si la chaîne est composée uniquement de chiffres (ex: "123")
  if (/^\d+$/.test(initProjectId)) {
    return parseInt(initProjectId, 10);
  }

  return initProjectId;
}