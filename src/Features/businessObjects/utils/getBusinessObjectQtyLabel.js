// Formats a business object's rolled-up quantity according to its unit.
// qties = {count, length, surface} summed over the object's linked
// annotations. Unit vocabulary matches annotationTemplate.mainQtyKey; a
// unit-less object (unit null — e.g. a title row) displays no quantity.
export default function getBusinessObjectQtyLabel(unit, qties) {
  if (!qties || !unit) return null;

  if (unit === "L") {
    return `${Number((qties.length ?? 0).toFixed(1))} ml`;
  }
  if (unit === "S") {
    return `${Number((qties.surface ?? 0).toFixed(1))} m²`;
  }
  return `${Number((qties.count ?? 0).toFixed(1))} u`;
}
