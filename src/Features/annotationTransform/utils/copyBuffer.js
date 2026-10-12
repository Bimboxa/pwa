// Typed buffer of the « Déplacer » / « Tourner » tools (2D and 3D) while an
// annotation is carried: `<value>[*<copies>]`.
//   Déplacer — value = distance (metres):
//   "1.3"    → the move is constrained to 1.30 m along the current direction
//              (cursor / Shift axis), the mouse only picks the direction
//   "*3"     → « copie multiple »: the original stays in place, 3 copies
//              land along the move vector, copy i at i × the vector (same
//              model as SketchUp's "3x")
//   "1.3*3"  → 3 copies with a 1.30 m pitch
//   Tourner — value = angle (user degrees, signed):
//   "45"     → the rotation is locked at 45°
//   "*3"     → 3 copies turned by i × the current angle around the pivot
//   "45*3"   → 3 copies at 45°, 90°, 135°
// Backspace erases one character; an empty buffer is a plain move / turn.
//
// Plain ESM (no path aliases) so the node tests can load it.

export const MAX_COPIES = 99;

const DIGIT_RE = /^[0-9]$/;

// `<value>[*<copies>]` → { valuePart, countPart } (countPart null without a
// `*`).
function splitBuffer(buffer) {
  const current = buffer ?? "";
  const starIndex = current.indexOf("*");
  return starIndex < 0
    ? { valuePart: current, countPart: null }
    : {
        valuePart: current.slice(0, starIndex),
        countPart: current.slice(starIndex + 1),
      };
}

// Next buffer after `key`, or the same buffer when the key is not accepted:
// digits / decimal separator feed the value until a `*`, `*` opens the copy
// count (typing it again restarts the count), digits then feed it.
// options.signed: a `-` is accepted as the FIRST character of the value.
function appendToTypedBuffer(buffer, key, { signed = false } = {}) {
  const current = buffer ?? "";
  const { valuePart, countPart } = splitBuffer(current);
  if (key === "*") return `${valuePart}*`;
  if (countPart !== null) {
    if (!DIGIT_RE.test(key)) return current;
    const next = countPart + key;
    if (Number(next) > MAX_COPIES) return current;
    return `${valuePart}*${next}`;
  }
  if (key === "-") {
    return signed && valuePart === "" ? "-" : current;
  }
  if (key === "." || key === ",") {
    if (valuePart.includes(".")) return current;
    const digits = valuePart === "" || valuePart === "-";
    return `${digits ? `${valuePart}0` : valuePart}.`;
  }
  if (!DIGIT_RE.test(key)) return current;
  return valuePart + key;
}

// « Déplacer »: `<distance>[*<copies>]`, distance ≥ 0.
export function appendToMoveBuffer(buffer, key) {
  return appendToTypedBuffer(buffer, key);
}

// « Tourner »: `<angle>[*<copies>]`, the angle may be negative.
export function appendToRotateBuffer(buffer, key) {
  return appendToTypedBuffer(buffer, key, { signed: true });
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
  const { valuePart } = splitBuffer(buffer);
  if (!valuePart) return null;
  const value = Number(valuePart);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Typed angle (user degrees, signed, 0 allowed), or null when the value
// part is empty / not parsable ("-", "1.").
export function parseTypedAngleDeg(buffer) {
  const { valuePart } = splitBuffer(buffer);
  if (!valuePart) return null;
  const value = Number(valuePart.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

// Chip labels: the typed distance / count, "—" while nothing is typed.
export function formatMoveLengthBuffer(buffer) {
  const { valuePart } = splitBuffer(buffer);
  return valuePart ? valuePart : "—";
}

export function formatCopyCountBuffer(buffer) {
  const { countPart } = splitBuffer(buffer);
  return countPart ? countPart : "—";
}

// Value part of the buffer as typed ("" when empty) — the helper's numeric
// field shows it without the `*N` tail.
export function formatAngleValueBuffer(buffer) {
  return splitBuffer(buffer).valuePart;
}

// Raw parts for the helper's fields: the value as typed and the copy count
// digits ("" when none).
export function getBufferValuePart(buffer) {
  return splitBuffer(buffer).valuePart;
}

export function getBufferCountPart(buffer) {
  return splitBuffer(buffer).countPart ?? "";
}

// Buffer rebuilt from a copy-count text (the helper's field, digits only)
// and the value already typed in `buffer`: an empty text drops the `*N`
// tail, digits beyond MAX_COPIES are refused (the previous count stays).
export function withCopyCountText(countText, buffer) {
  const { valuePart, countPart } = splitBuffer(buffer);
  const digits = (countText ?? "").replace(/[^0-9]/g, "");
  if (digits === "") return valuePart;
  if (Number(digits) > MAX_COPIES) {
    return countPart === null ? valuePart : `${valuePart}*${countPart}`;
  }
  return `${valuePart}*${digits}`;
}

// Buffer rebuilt from a value text (the helper's field) and the `*N` tail
// already typed in `buffer`, so editing the field keeps the copies.
export function withCopyCountPart(valueText, buffer) {
  const { countPart } = splitBuffer(buffer);
  const value = (valueText ?? "").replace("*", "");
  return countPart === null ? value : `${value}*${countPart}`;
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

// Angle label of the « Tourner » tools: "45°", "45° ×3".
export function formatRotateBadge({ angleLabel, count }) {
  const parts = [];
  if (angleLabel) parts.push(angleLabel);
  if (count > 0) parts.push(`×${count}`);
  return parts.join(" ");
}
