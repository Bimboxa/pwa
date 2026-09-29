import getBusinessObjectQtyKind from "./getBusinessObjectQtyKind.js";

function getKindValue(kind, qties) {
  if (kind === "LENGTH") return qties?.length ?? 0;
  if (kind === "SURFACE") return qties?.surface ?? 0;
  return qties?.count ?? 0;
}

// Quantity of a business object in its own unit, from its rolled-up
// {count, length, surface} (useBusinessObjectQties). The unit is a free text:
// the quantity kind is deduced from it (getBusinessObjectQtyKind — "ml" →
// length, "m²" → surface, else count). null for a unit-less object (e.g. a
// title row) or without quantities.
//
// Annotations whose template has a custom quantity formula (qties.formula,
// see accumulateAnnotationQties) count for their formula value instead of
// their raw quantity.
export default function getBusinessObjectQtyValue(unit, qties) {
  const kind = getBusinessObjectQtyKind(unit);
  if (!qties || !kind) return null;
  const value = getKindValue(kind, qties);
  if (!qties.formula) return value;
  return value - getKindValue(kind, qties.formula) + qties.formula.value;
}
