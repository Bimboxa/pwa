// Typed buffer of the « Plan de coupe » command (Maillage module):
// `<length>[*<count> | /<count>]`.
//   "1.5"    → the axis P1 → P2 is constrained to 1.50 m, one plane at P2
//   "*4"     → REPEAT: 4 planes, plane i at P1 + i × (P2 - P1) — the pitch
//              is repeated beyond P2
//   "/4"     → DIVIDE: 4 planes splitting P1 → P2, plane i at
//              P1 + (i / 4) × (P2 - P1) — P1 excluded, the last one at P2
//   "1.5*4"  → 4 planes with a 1.50 m pitch
//   "6/4"    → 4 planes over 6 m (1.50 m apart)
// Backspace erases one character; an empty buffer is a single plane at P2.
//
// Plain ESM (no path aliases) so the node tests can load it.

export const MAX_CUT_PLANES = 99;

export const CUT_PLANE_MODES = { REPEAT: "REPEAT", DIVIDE: "DIVIDE" };

const DIGIT_RE = /^[0-9]$/;
const OPERATOR_RE = /[*/]/;

// `<length>[<op><count>]` → { valuePart, operator, countPart } (operator and
// countPart null without a `*` / `/`).
function splitBuffer(buffer) {
  const current = buffer ?? "";
  const index = current.search(OPERATOR_RE);
  return index < 0
    ? { valuePart: current, operator: null, countPart: null }
    : {
        valuePart: current.slice(0, index),
        operator: current[index],
        countPart: current.slice(index + 1),
      };
}

// Next buffer after `key`, or the same buffer when the key is not accepted:
// digits / decimal separator feed the length until an operator, `*` or `/`
// opens the count (typing one again restarts the count with that operator),
// digits then feed it.
export function appendToCutPlaneBuffer(buffer, key) {
  const current = buffer ?? "";
  const { valuePart, operator, countPart } = splitBuffer(current);
  if (key === "*" || key === "/") return `${valuePart}${key}`;
  if (operator !== null) {
    if (!DIGIT_RE.test(key)) return current;
    const next = countPart + key;
    if (Number(next) > MAX_CUT_PLANES) return current;
    return `${valuePart}${operator}${next}`;
  }
  if (key === "." || key === ",") {
    if (valuePart.includes(".")) return current;
    return `${valuePart === "" ? "0" : valuePart}.`;
  }
  if (!DIGIT_RE.test(key)) return current;
  return valuePart + key;
}

// { lengthM, count, mode }: the typed length (metres, > 0, else null), the
// number of planes (≥ 1: no operator / "*" / "*0" count as one plane) and
// how they are laid out.
export function parseCutPlaneBuffer(buffer) {
  const { valuePart, operator, countPart } = splitBuffer(buffer);
  const value = valuePart ? Number(valuePart) : NaN;
  const lengthM = Number.isFinite(value) && value > 0 ? value : null;
  const n = countPart ? Number(countPart) : NaN;
  const count = Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_CUT_PLANES) : 1;
  const mode =
    operator === "/" ? CUT_PLANE_MODES.DIVIDE : CUT_PLANE_MODES.REPEAT;
  return { lengthM, count, mode };
}

// Raw parts for the helper's fields: the length as typed and the count
// digits ("" when none).
export function getCutPlaneValuePart(buffer) {
  return splitBuffer(buffer).valuePart;
}

export function getCutPlaneCountPart(buffer) {
  return splitBuffer(buffer).countPart ?? "";
}

// Mode as typed ("*" / "/" seen, whatever the count).
export function getCutPlaneMode(buffer) {
  return splitBuffer(buffer).operator === "/"
    ? CUT_PLANE_MODES.DIVIDE
    : CUT_PLANE_MODES.REPEAT;
}

// Buffer rebuilt from the helper's fields. Without a count, REPEAT drops
// the operator and DIVIDE keeps a bare "/" (the mode stays as chosen).
export function buildCutPlaneBuffer({ valueText, countText, mode }) {
  const value = (valueText ?? "").replace(",", ".").replace(/[^0-9.]/g, "");
  const digits = (countText ?? "").replace(/[^0-9]/g, "");
  const divide = mode === CUT_PLANE_MODES.DIVIDE;
  if (digits === "") return divide ? `${value}/` : value;
  const count = Math.min(Number(digits), MAX_CUT_PLANES);
  return `${value}${divide ? "/" : "*"}${count}`;
}

// Badge text next to the cursor: "×4" / "÷4", "" for a single plane.
export function formatCutPlaneCount(buffer) {
  const { count, mode } = parseCutPlaneBuffer(buffer);
  if (count < 2) return "";
  return `${mode === CUT_PLANE_MODES.DIVIDE ? "÷" : "×"}${count}`;
}
