import { useDispatch, useSelector } from "react-redux";

import {
  triggerWorkPackagesUpdate,
  triggerRelsWorkPackageAnnotationUpdate,
  setSelectedWorkPackageId,
  setLinkingWorkPackageId,
} from "../businessObjectsSlice";
import { triggerPlanningUpdate } from "Features/planning/planningSlice";

import db from "App/db/db";

// Deletes a work package with its annotation links and its planning blocks.
// The annotations themselves are untouched (they belong to the Dessin).
export default function useDeleteWorkPackage() {
  const dispatch = useDispatch();
  const selectedWorkPackageId = useSelector(
    (s) => s.businessObjects.selectedWorkPackageId
  );
  const linkingWorkPackageId = useSelector(
    (s) => s.businessObjects.linkingWorkPackageId
  );

  const deleteWorkPackage = async (workPackage) => {
    let slotsDeleted = 0;
    await db.transaction(
      "rw",
      [db.workPackages, db.relsWorkPackageAnnotation, db.planningSlots],
      async () => {
        await db.workPackages.delete(workPackage.id);
        const rels = (
          await db.relsWorkPackageAnnotation
            .where("workPackageId")
            .equals(workPackage.id)
            .toArray()
        ).filter((r) => !r.deletedAt);
        if (rels.length > 0)
          await db.relsWorkPackageAnnotation.bulkDelete(rels.map((r) => r.id));
        const slots = (
          await db.planningSlots
            .where("workPackageId")
            .equals(workPackage.id)
            .toArray()
        ).filter((s) => !s.deletedAt);
        if (slots.length > 0) {
          await db.planningSlots.bulkDelete(slots.map((s) => s.id));
          slotsDeleted = slots.length;
        }
      }
    );
    if (selectedWorkPackageId === workPackage.id)
      dispatch(setSelectedWorkPackageId(null));
    if (linkingWorkPackageId === workPackage.id)
      dispatch(setLinkingWorkPackageId(null));
    dispatch(triggerWorkPackagesUpdate());
    dispatch(triggerRelsWorkPackageAnnotationUpdate());
    if (slotsDeleted > 0) dispatch(triggerPlanningUpdate());
  };

  return deleteWorkPackage;
}
