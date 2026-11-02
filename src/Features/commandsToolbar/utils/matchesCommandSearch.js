// Search of the « Commandes » dialog: case- and accent-insensitive, every
// word of the typed text must appear in the command label or in its helper
// description (raw Markdown). An empty search matches everything.

export function normalizeSearchText(text) {
  return (text ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function getSearchWords(search) {
  return normalizeSearchText(search).split(/\s+/).filter(Boolean);
}

export default function matchesCommandSearch(command, helper, words) {
  if (!words || words.length === 0) return true;
  const haystack = normalizeSearchText(
    `${command?.label ?? ""} ${helper?.description ?? ""}`
  );
  return words.every((word) => haystack.includes(word));
}
