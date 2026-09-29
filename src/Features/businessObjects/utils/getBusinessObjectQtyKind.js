// The unit of a business object is a FREE TEXT ("m²", "ens", "kg"...). The
// quantity rolled up from the linked annotations is deduced from that text:
// "m²" / "m2" → surface, "ml" / "m" → length, anything else → count.
//
// Legacy rows (and the tasks' hoursRatioUnit) store the former enum keys
// "U" / "L" / "S": they are read as u / ml / m² (read-time fallback, no
// migration).

const LEGACY_UNITS = {
  U: { kind: "COUNT", label: "u" },
  L: { kind: "LENGTH", label: "ml" },
  S: { kind: "SURFACE", label: "m²" },
};

const KIND_BY_TOKEN = {
  m2: "SURFACE",
  "m²": "SURFACE",
  m: "LENGTH",
  ml: "LENGTH",
};

function toText(unit) {
  return typeof unit === "string" ? unit.trim() : "";
}

// "COUNT" | "LENGTH" | "SURFACE" | null (unit-less)
export default function getBusinessObjectQtyKind(unit) {
  const text = toText(unit);
  if (!text) return null;
  if (LEGACY_UNITS[text]) return LEGACY_UNITS[text].kind;
  const token = text.toLowerCase().replace(/[.\s]+/g, "");
  return KIND_BY_TOKEN[token] ?? "COUNT";
}

// Display text of a unit: the text itself, legacy keys mapped to
// u / ml / m². "" for a unit-less object.
export function getBusinessObjectUnitText(unit) {
  const text = toText(unit);
  return LEGACY_UNITS[text]?.label ?? text;
}
