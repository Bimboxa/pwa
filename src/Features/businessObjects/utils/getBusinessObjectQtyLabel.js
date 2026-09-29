import formatBusinessObjectNumber from "./formatBusinessObjectNumber.js";
import { getBusinessObjectUnitText } from "./getBusinessObjectQtyKind.js";
import getBusinessObjectQtyValue from "./getBusinessObjectQtyValue.js";

// Display label of a business object unit: the free text itself, the legacy
// keys U / L / S read as "u" / "ml" / "m²". "u" without unit.
export function getBusinessObjectUnitLabel(unit) {
  return getBusinessObjectUnitText(unit) || "u";
}

// Formats a business object's rolled-up quantity according to its unit.
// qties = {count, length, surface} summed over the object's linked
// annotations. A unit-less object (unit null — e.g. a title row) displays no
// quantity.
export default function getBusinessObjectQtyLabel(unit, qties) {
  const value = getBusinessObjectQtyValue(unit, qties);
  if (value == null) return null;
  return `${formatBusinessObjectNumber(value, 1)} ${getBusinessObjectUnitLabel(unit)}`;
}
