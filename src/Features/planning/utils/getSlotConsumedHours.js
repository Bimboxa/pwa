import { DEFAULT_STEP_HOURS } from "../constants/planningDefaults";

// Hours consumed by one block: one resource during `steps` steps of
// `planning.stepHours` hours.
export default function getSlotConsumedHours(slot, planning) {
  const steps = Number.isFinite(slot?.steps) ? Math.max(0, slot.steps) : 0;
  const stepHours = Number.isFinite(planning?.stepHours)
    ? planning.stepHours
    : DEFAULT_STEP_HOURS;
  return steps * stepHours;
}
