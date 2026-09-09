import { BUSINESS_OBJECT_UNITS } from "../constants/businessObjectEntityModel";

import formatBusinessObjectNumber from "./formatBusinessObjectNumber";
import getBusinessObjectQtyValue from "./getBusinessObjectQtyValue";

// "u" / "ml" / "m²" — display label of a business object unit key.
export function getBusinessObjectUnitLabel(unit) {
  return BUSINESS_OBJECT_UNITS.find((u) => u.key === unit)?.label ?? "u";
}

// Formats a business object's rolled-up quantity according to its unit.
// qties = {count, length, surface} summed over the object's linked
// annotations. Unit vocabulary matches annotationTemplate.mainQtyKey; a
// unit-less object (unit null — e.g. a title row) displays no quantity.
export default function getBusinessObjectQtyLabel(unit, qties) {
  const value = getBusinessObjectQtyValue(unit, qties);
  if (value == null) return null;
  return `${formatBusinessObjectNumber(value, 1)} ${getBusinessObjectUnitLabel(unit)}`;
}
