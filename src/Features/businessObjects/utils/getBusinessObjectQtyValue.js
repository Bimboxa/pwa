import getBusinessObjectQtyKind from "./getBusinessObjectQtyKind.js";

// Quantity of a business object in its own unit, from its rolled-up
// {count, length, surface} (useBusinessObjectQties). The unit is a free text:
// the quantity kind is deduced from it (getBusinessObjectQtyKind — "ml" →
// length, "m²" → surface, else count). null for a unit-less object (e.g. a
// title row) or without quantities.
export default function getBusinessObjectQtyValue(unit, qties) {
  const kind = getBusinessObjectQtyKind(unit);
  if (!qties || !kind) return null;
  if (kind === "LENGTH") return qties.length ?? 0;
  if (kind === "SURFACE") return qties.surface ?? 0;
  return qties.count ?? 0;
}
