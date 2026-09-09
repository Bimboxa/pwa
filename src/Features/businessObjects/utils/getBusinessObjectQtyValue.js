// Quantity of a business object in its own unit, from its rolled-up
// {count, length, surface} (useBusinessObjectQties): L → length (ml),
// S → surface (m²), else count (u). null for a unit-less object (e.g. a
// title row) or without quantities.
export default function getBusinessObjectQtyValue(unit, qties) {
  if (!qties || !unit) return null;
  if (unit === "L") return qties.length ?? 0;
  if (unit === "S") return qties.surface ?? 0;
  return qties.count ?? 0;
}
