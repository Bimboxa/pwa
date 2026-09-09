import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";
import { useDispatch } from "react-redux";

import { triggerWorkPackagesUpdate } from "../businessObjectsSlice";

import db from "App/db/db";

import { DEFAULT_BUSINESS_OBJECT_COLOR } from "../constants/businessObjectEntityModel";

export const DEFAULT_WORK_PACKAGE_LABEL = "Nouvelle tâche";

export default function useCreateWorkPackage() {
  const dispatch = useDispatch();

  // workStationIds: the tasks the package covers; empty / omitted = every
  // task of the listing applies (derived default, see useWorkPackageHours).
  const create = async ({ listing, label, color, workStationIds }) => {
    const listingId = listing.id;
    const existing = (
      await db.workPackages.where("listingId").equals(listingId).toArray()
    ).filter((z) => !z.deletedAt);
    const lastSortIndex = existing
      .map((z) => z.sortIndex)
      .filter((s) => s != null)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .pop();

    const workPackage = {
      id: nanoid(),
      listingId,
      projectId: listing.projectId,
      scopeId: listing.scopeId,
      label: label || `${DEFAULT_WORK_PACKAGE_LABEL} ${existing.length + 1}`,
      color: color || DEFAULT_BUSINESS_OBJECT_COLOR,
      workStationIds: Array.isArray(workStationIds) ? [...workStationIds] : [],
      sortIndex: generateKeyBetween(lastSortIndex ?? null, null),
    };
    await db.workPackages.add(workPackage);
    dispatch(triggerWorkPackagesUpdate());
    return workPackage;
  };

  return create;
}
