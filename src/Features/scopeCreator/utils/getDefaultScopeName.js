export default function getDefaultScopeName({ trigram }) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return ["Repérage", `${dd}/${mm}`, trigram].filter(Boolean).join(" ");
}
