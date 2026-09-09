import { useMemo } from "react";

import usePlanningOfListing from "./usePlanningOfListing";
import usePlanningSlots from "./usePlanningSlots";

import getSlotConsumedHours from "../utils/getSlotConsumedHours";

const EMPTY = { consumedByWorkPackageId: {}, totalConsumed: 0, planning: null };

// Hours consumed per work package = Σ over the planning blocks scheduled on it
// of steps × stepHours. Consumed by the work-zone rows / properties panel
// (consumed vs budget) and the block tooltips.
export default function usePlanningConsumedHours({ listingId } = {}) {
  const { value: planning } = usePlanningOfListing({ listingId });
  const { value: slots } = usePlanningSlots({ planningId: planning?.id });

  return useMemo(() => {
    if (!planning) return EMPTY;
    const consumedByWorkPackageId = {};
    let totalConsumed = 0;
    slots.forEach((slot) => {
      if (!slot.workPackageId) return;
      const hours = getSlotConsumedHours(slot, planning);
      consumedByWorkPackageId[slot.workPackageId] =
        (consumedByWorkPackageId[slot.workPackageId] ?? 0) + hours;
      totalConsumed += hours;
    });
    return { consumedByWorkPackageId, totalConsumed, planning };
  }, [planning, slots]);
}
