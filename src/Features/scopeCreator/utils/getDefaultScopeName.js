export default function getDefaultScopeName({ trigram }) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return ["Repérage", `${dd}/${mm}`, `${hh}:${min}`, trigram]
    .filter(Boolean)
    .join(" ");
}
