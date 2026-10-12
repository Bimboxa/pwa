// « Copie multiple » buffer of the « Déplacer » tools (2D and 3D): while an
// annotation is carried, typing `x` then digits (e.g. "x3") turns the move
// into N copies laid along the move vector — the original stays in place,
// copy i lands at i × the vector (same model as SketchUp's "3x"). Backspace
// erases one character; an empty buffer (or a bare "x") is a plain move.
//
// Plain ESM (no path aliases) so the node tests can load it.

export const MAX_COPIES = 99;

const DIGIT_RE = /^[0-9]$/;

// Next buffer after `key`, or the same buffer when the key is not accepted:
// `x` / `X` (re)starts the buffer, digits only follow an `x`.
export function appendToCopyBuffer(buffer, key) {
  const current = buffer ?? "";
  if (key === "x" || key === "X") return "x";
  if (!DIGIT_RE.test(key) || !current.startsWith("x")) return current;
  const next = current + key;
  if (Number(next.slice(1)) > MAX_COPIES) return current;
  return next;
}

// Number of copies the buffer asks for (≥ 1), 0 when the buffer is empty, a
// bare "x" or "x0".
export function parseCopyCount(buffer) {
  if (!buffer || !buffer.startsWith("x")) return 0;
  const n = Number(buffer.slice(1));
  if (!Number.isInteger(n) || n < 1) return 0;
  return Math.min(n, MAX_COPIES);
}

// Chip label: "x3", or "—" while nothing is typed.
export function formatCopyBuffer(buffer) {
  return buffer ? buffer : "—";
}
