// Helpers for the crop of a PDF page ("zone of interest"), expressed as
// fractions [0..1] of the ROTATED page: { x1, y1, x2, y2 }, origin top-left.
// Pure module (no imports): shared by the detail baseMap services, the import
// validators and the node tests.

const DECIMALS = 4;

function round(value) {
  const factor = 10 ** DECIMALS;
  return Math.round(value * factor) / factor;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// Returns a clean { x1, y1, x2, y2 } or null when the box is missing,
// invalid, empty, or covers the whole page (null = whole page everywhere).
export function normalizeBboxInRatio(bbox) {
  if (!bbox || typeof bbox !== "object") return null;
  const values = [bbox.x1, bbox.y1, bbox.x2, bbox.y2];
  if (!values.every((v) => typeof v === "number" && Number.isFinite(v)))
    return null;

  const x1 = round(clamp01(Math.min(bbox.x1, bbox.x2)));
  const x2 = round(clamp01(Math.max(bbox.x1, bbox.x2)));
  const y1 = round(clamp01(Math.min(bbox.y1, bbox.y2)));
  const y2 = round(clamp01(Math.max(bbox.y1, bbox.y2)));
  if (!(x2 > x1) || !(y2 > y1)) return null;
  if (x1 <= 0 && y1 <= 0 && x2 >= 1 && y2 >= 1) return null;

  return { x1, y1, x2, y2 };
}

// Two crops are the same zone when every edge matches within `eps`
// (a model rarely returns the exact same fractions twice).
export function sameBboxInRatio(a, b, eps = 1e-3) {
  const na = normalizeBboxInRatio(a);
  const nb = normalizeBboxInRatio(b);
  if (!na || !nb) return !na && !nb;
  return (
    Math.abs(na.x1 - nb.x1) <= eps &&
    Math.abs(na.y1 - nb.y1) <= eps &&
    Math.abs(na.x2 - nb.x2) <= eps &&
    Math.abs(na.y2 - nb.y2) <= eps
  );
}

// Suffix of a cache / dedup key: "" for the whole page.
export function bboxKey(bbox) {
  const n = normalizeBboxInRatio(bbox);
  return n ? `@b${n.x1},${n.y1},${n.x2},${n.y2}` : "";
}
