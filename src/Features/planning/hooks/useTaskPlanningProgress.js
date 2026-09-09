import { useMemo } from "react";
import { useSelector } from "react-redux";

import usePlanningOfListing from "./usePlanningOfListing";
import usePlanningSlots from "./usePlanningSlots";
import useWorkPackageHours from "Features/businessObjects/hooks/useWorkPackageHours";

import getWorkPackagePlayStatusById, {
  PLAY_STATUS,
} from "../utils/getWorkPackagePlayStatusById";

const EMPTY = { byTaskId: {}, playActive: false };

// Per-task planning progress of a PLANNING listing: total = the task's hours
// over every work package, planned = over the packages carrying at least
// one block, done = over the packages DONE at the play step (play mode).
// byTaskId[taskId] = {total, planned, done, plannedRatio, doneRatio}.
export default function useTaskPlanningProgress({ listingId } = {}) {
  const { workPackages, hoursByWorkPackageIdByTaskId, totalByTaskId } =
    useWorkPackageHours({ listingId });
  const { value: planning } = usePlanningOfListing({ listingId });
  const { value: slots } = usePlanningSlots({ planningId: planning?.id });
  const playActive = useSelector((s) => s.planning.playActive);
  const playStep = useSelector((s) => s.planning.playStep);

  return useMemo(() => {
    if (!listingId) return EMPTY;
    const scheduled = new Set(slots.map((s) => s.workPackageId));
    const statusById = playActive
      ? getWorkPackagePlayStatusById(workPackages, slots, playStep)
      : null;
    const byTaskId = {};
    Object.keys(totalByTaskId).forEach((taskId) => {
      byTaskId[taskId] = { total: totalByTaskId[taskId], planned: 0, done: 0 };
    });
    workPackages.forEach((wp) => {
      const hoursByTaskId = hoursByWorkPackageIdByTaskId[wp.id] ?? {};
      Object.entries(hoursByTaskId).forEach(([taskId, hours]) => {
        const entry = byTaskId[taskId];
        if (!entry) return;
        if (scheduled.has(wp.id)) entry.planned += hours;
        if (statusById?.[wp.id] === PLAY_STATUS.DONE) entry.done += hours;
      });
    });
    Object.values(byTaskId).forEach((e) => {
      e.plannedRatio = e.total > 0 ? e.planned / e.total : null;
      e.doneRatio = e.total > 0 && playActive ? e.done / e.total : null;
    });
    return { byTaskId, playActive };
  }, [
    listingId,
    workPackages,
    hoursByWorkPackageIdByTaskId,
    totalByTaskId,
    slots,
    playActive,
    playStep,
  ]);
}
