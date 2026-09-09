import { DEFAULT_HOURS_RATIO_UNIT } from "../constants/businessObjectEntityModel";

// Unit of a task's hours ratio (u / ml / m²), the unit its rolled-up quantity
// is read in. Read-time fallback on the legacy quantity unit: tasks written
// before `hoursRatioUnit` existed stored that unit in `unit`.
export default function getHoursRatioUnit(businessObject) {
  return (
    businessObject?.hoursRatioUnit ??
    businessObject?.unit ??
    DEFAULT_HOURS_RATIO_UNIT
  );
}
