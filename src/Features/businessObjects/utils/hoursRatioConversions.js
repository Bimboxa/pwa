import { DEFAULT_HOURS_RATIO_MODE } from "../constants/businessObjectEntityModel";

import formatBusinessObjectNumber from "./formatBusinessObjectNumber";
import getHoursRatioUnit from "./getHoursRatioUnit";
import { getBusinessObjectUnitLabel } from "./getBusinessObjectQtyLabel";

// Hours ratio of a PLANNING task: the stored value is the RATIO (hours per
// unit); CADENCE (units per hour) is its inverse, a display / input mode
// only. A ratio only makes sense when > 0 (0 has no cadence): anything else
// reads as "no ratio".

export function isValidHoursRatio(ratio) {
  return Number.isFinite(ratio) && ratio > 0;
}

export function getCadenceFromRatio(ratio) {
  return isValidHoursRatio(ratio) ? 1 / ratio : null;
}

export function getRatioFromCadence(cadence) {
  return isValidHoursRatio(cadence) ? 1 / cadence : null;
}

// Number shown in the ratio field for a mode (null = empty field).
export function getDisplayedHoursRatio(
  hoursRatio,
  mode = DEFAULT_HOURS_RATIO_MODE
) {
  if (!isValidHoursRatio(hoursRatio)) return null;
  return mode === "CADENCE" ? getCadenceFromRatio(hoursRatio) : hoursRatio;
}

// Inverse: the field number (in `mode`) → stored ratio (hours per unit).
export function getHoursRatioFromDisplayed(
  value,
  mode = DEFAULT_HOURS_RATIO_MODE
) {
  if (!isValidHoursRatio(value)) return null;
  return mode === "CADENCE" ? getRatioFromCadence(value) : value;
}

// "1,25" / "1.25" / "" → number | null (comma-tolerant, like FieldTextV2).
export function parseHoursRatioInput(text) {
  const s = String(text ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Text of the ratio field for a stored ratio in a mode ("" = no ratio),
// 4 decimals max so the inverse of a rounded value stays readable.
export function getHoursRatioInputText(
  hoursRatio,
  mode = DEFAULT_HOURS_RATIO_MODE
) {
  const value = getDisplayedHoursRatio(hoursRatio, mode);
  return value == null ? "" : String(Number(value.toFixed(4)));
}

// "h/m²" (RATIO) or "m²/h" (CADENCE).
export function getHoursRatioUnitLabel(unit, mode = DEFAULT_HOURS_RATIO_MODE) {
  const u = getBusinessObjectUnitLabel(unit);
  return mode === "CADENCE" ? `${u}/h` : `h/${u}`;
}

// Hours in a man-day ("Jr.H"): fixed 8 h, independent of a planning's own
// hoursPerDay (the day count is a reading aid, not a scheduling unit).
export const HOURS_PER_MAN_DAY = 8;

// Man-days of an hours amount, rounded to the half day.
export function getManDays(hours) {
  const h = Number.isFinite(hours) ? hours : 0;
  return Math.round((h / HOURS_PER_MAN_DAY) * 2) / 2;
}

// "138 h (17,5 Jr.H)" — hours rounded to the unit, man-days in parentheses.
// `withDays: false` drops the parentheses where space is tight (paired
// values, narrow columns).
export function formatHours(hours, { withDays = true } = {}) {
  const h = `${formatBusinessObjectNumber(hours, 0)} h`;
  if (!withDays) return h;
  return `${h} (${formatBusinessObjectNumber(getManDays(hours), 1)} Jr.H)`;
}

// "0,5 h/m²" or "2 m²/h" per the task's persisted mode; null without ratio.
export function formatHoursRatio(businessObject) {
  const mode = businessObject?.hoursRatioMode ?? DEFAULT_HOURS_RATIO_MODE;
  const value = getDisplayedHoursRatio(businessObject?.hoursRatio, mode);
  if (value == null) return null;
  return `${formatBusinessObjectNumber(value, 2)} ${getHoursRatioUnitLabel(
    getHoursRatioUnit(businessObject),
    mode
  )}`;
}
