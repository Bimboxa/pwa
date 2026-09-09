export const PLAY_STATUS = {
  DONE: "DONE",
  IN_PROGRESS: "IN_PROGRESS",
  TODO: "TODO",
};

// Status of every work package at a step of the planning: IN_PROGRESS when
// a block covers the step, DONE when the package has blocks and all of them
// end at or before the step, TODO otherwise (no block yet, or blocks later).
// Returns a plain object {workPackageId: status}.
export default function getWorkPackagePlayStatusById(
  workPackages,
  slots,
  step
) {
  const byId = {};
  const s = Math.max(0, Math.floor(step ?? 0));
  (workPackages ?? []).forEach((z) => {
    byId[z.id] = PLAY_STATUS.TODO;
  });
  const hasBlock = {};
  const allDone = {};
  (slots ?? []).forEach((slot) => {
    const id = slot.workPackageId;
    if (!id || byId[id] === undefined) return;
    const start = slot.startStep ?? 0;
    const end = start + (slot.steps ?? 1); // exclusive
    hasBlock[id] = true;
    if (start <= s && s < end) {
      byId[id] = PLAY_STATUS.IN_PROGRESS;
    } else if (end <= s) {
      if (allDone[id] === undefined) allDone[id] = true;
    } else {
      allDone[id] = false;
    }
  });
  Object.keys(byId).forEach((id) => {
    if (byId[id] === PLAY_STATUS.IN_PROGRESS) return;
    if (hasBlock[id] && allDone[id] === true) byId[id] = PLAY_STATUS.DONE;
  });
  return byId;
}
