// Work package SELECTED in the PLANNING drawer ("Tâches" tab) — same contract
// as selectSelectedBusinessObjectId: the selection slice owns it, and
// businessObjects.activeWorkPackageId is the persistent counterpart (Gantt
// slot creation target).
export default function selectSelectedWorkPackageId(s) {
  const item = s.selection?.selectedItems?.[0];
  return item?.type === "WORK_PACKAGE" ? item.id : null;
}
