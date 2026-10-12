// Typed buffer of the « Déplacer » tools (2D and 3D) while an annotation is
// carried: `<distance>[*<copies>]`.
//   "1.3"    → the move is constrained to 1.30 m along the current direction
//              (cursor / Shift axis), the mouse only picks the direction
//   "*3"     → « copie multiple »: the original stays in place, 3 copies
//              land along the move vector, copy i at i × the vector (same
//              model as SketchUp's "3x")
//   "1.3*3"  → 3 copies with a 1.30 m pitch
// Backspace erases one character; an empty buffer is a plain move.
//
// Plain ESM (no path aliases) so the node tests can load it.

export const MAX_COPIES = 99;

const DIGIT_RE = /^[0-9]$/;

function splitBuffer(buffer) {
  const current = buffer ?? "";
  const xIndex = current.indexOf("*");
  return xIndex < 0
    ? { lengthPart: current, countPart: null }
    : {
        lengthPart: current.slice(0, xIndex),
        countPart: current.slice(xIndex + 1),
      };
}

// Next buffer after `key`, or the same buffer when the key is not accepted:
// digits / decimal separator feed the distance until a `*`, `*` opens the
// copy count (typing it again restarts the count), digits then feed it.
export function appendToMoveBuffer(buffer, key) {
  const current = buffer ?? "";
  const { lengthPart, countPart } = splitBuffer(current);
  if (key === "*") return `${lengthPart}*`;
  if (countPart !== null) {
    if (!DIGIT_RE.test(key)) return current;
    const next = countPart + key;
    if (Number(next) > MAX_COPIES) return current;
    return `${lengthPart}*${next}`;
  }
  if (key === "." || key === ",") {
    if (lengthPart.includes(".")) return current;
    return `${lengthPart === "" ? "0" : lengthPart}.`;
  }
  if (!DIGIT_RE.test(key)) return current;
  return lengthPart + key;
}

// Number of copies the buffer asks for (≥ 1), 0 when none / "*" / "*0".
export function parseCopyCount(buffer) {
  const { countPart } = splitBuffer(buffer);
  if (countPart === null) return 0;
  const n = Number(countPart);
  if (!Number.isInteger(n) || n < 1) return 0;
  return Math.min(n, MAX_COPIES);
}

// Typed distance (metres, > 0), or null when none is typed yet.
export function parseMoveLength(buffer) {
  const { lengthPart } = splitBuffer(buffer);
  if (!lengthPart) return null;
  const value = Number(lengthPart);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Chip labels: the typed distance / count, "—" while nothing is typed.
export function formatMoveLengthBuffer(buffer) {
  const { lengthPart } = splitBuffer(buffer);
  return lengthPart ? lengthPart : "—";
}

export function formatCopyCountBuffer(buffer) {
  const { countPart } = splitBuffer(buffer);
  return countPart ? countPart : "—";
}

// Rescales a move delta ({x, y} or {x, y, z}) to the typed length (same
// unit as the delta); unchanged without a length or on a degenerate delta.
export function scaleDeltaToLength(delta, length) {
  if (!delta || !(length > 0)) return delta;
  const z = delta.z ?? 0;
  const norm = Math.sqrt(delta.x * delta.x + delta.y * delta.y + z * z);
  if (norm < 1e-9) return delta;
  const k = length / norm;
  return delta.z === undefined
    ? { x: delta.x * k, y: delta.y * k }
    : { x: delta.x * k, y: delta.y * k, z: z * k };
}

// Badge text that follows the cursor: "1.300 m", "1.300 m ×3" — `axis`
// (3D Shift lock) prefixes it.
export function formatMoveBadge({ lengthM, count, axis }) {
  const parts = [];
  if (axis) parts.push(axis);
  if (Number.isFinite(lengthM)) parts.push(`${lengthM.toFixed(3)} m`);
  if (count > 0) parts.push(`×${count}`);
  return parts.join(" ");
}
