import { normalizeTrigram } from "App/db/ownership";

// "abc; def ;;ABC" -> ["ABC", "DEF"] — the storage format of
// scope.editorsTrigrams (normalized, deduped, no empties).
export default function parseEditorsTrigrams(str) {
  const parts = String(str ?? "")
    .split(";")
    .map(normalizeTrigram)
    .filter(Boolean);
  return [...new Set(parts)];
}
