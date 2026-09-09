import { useDispatch } from "react-redux";

import { triggerWorkPackagesUpdate } from "../businessObjectsSlice";

import db from "App/db/db";

export default function useUpdateWorkPackage() {
  const dispatch = useDispatch();

  // workStationIds: tasks covered by the package ([] = every task applies).
  const update = async (
    workPackageId,
    { label, color, workStationIds } = {}
  ) => {
    const updates = {};
    if (label != null) updates.label = label;
    if (color != null) updates.color = color;
    if (Array.isArray(workStationIds))
      updates.workStationIds = [...workStationIds];
    if (Object.keys(updates).length === 0) return;
    await db.workPackages.update(workPackageId, updates);
    dispatch(triggerWorkPackagesUpdate());
  };

  return update;
}
