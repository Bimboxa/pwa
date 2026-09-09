import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useBusinessObjects from "./useBusinessObjects";
import { isBusinessObjectsModuleKey } from "../utils/businessObjectModuleKeys";

import buildBusinessObjectsTree, {
  getBusinessObjectDescendants,
} from "../utils/buildBusinessObjectsTree";
import getBusinessObjectHoursBudget from "../utils/getBusinessObjectHoursBudget";
import getBusinessObjectQtyValue from "../utils/getBusinessObjectQtyValue";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import getHoursRatioUnit from "../utils/getHoursRatioUnit";
import { isValidHoursRatio } from "../utils/hoursRatioConversions";

const EMPTY = { tasks: [], workPackage: null, total: null };

// Hours ONE annotation represents for each task of the active PLANNING
// listing. The annotation must belong to a work package (an unlinked
// annotation carries no planned hours: EMPTY, the caller shows nothing).
// Tasks kept: those covered by the package (workStationIds, empty = all)
// whose global layer matches the annotation's layer (null = every
// annotation), restricted to the task soloed in the panel (with its
// sub-tasks) when there is one. Hours = the annotation's quantity in the
// task's ratio unit × ratio.
//
// Returns EMPTY outside a business-objects module / a PLANNING listing, so
// callers (the map hover tooltip) can render unconditionally.
export default function useAnnotationTaskHours({ annotation, qties } = {}) {
  // context: PLANNING module + its active listing

  const isPlanningModule = useSelector((s) =>
    isBusinessObjectsModuleKey(s.viewers?.selectedViewerKey)
  );
  const listingId = useSelector((s) => s.businessObjects?.selectedListingId);
  const listing = useSelector((s) =>
    listingId ? (s.listings.listingsById?.[listingId] ?? null) : null
  );
  const hasWorkPackages = Boolean(
    getBusinessObjectTypeOfListing(listing).features?.workPackages
  );
  const enabled = Boolean(
    isPlanningModule && hasWorkPackages && annotation?.id
  );

  // data

  const { value: businessObjects } = useBusinessObjects({
    listingId: enabled ? listingId : null,
  });

  // task soloed in the "Poste de travail" tab: the tooltip then shows that
  // task (and its sub-tasks) only
  const selectedTaskId = useSelector(
    (s) => s.businessObjects?.selectedBusinessObjectId ?? null
  );

  const relsUpdatedAt = useSelector(
    (s) => s.businessObjects?.relsWorkPackageUpdatedAt
  );
  const workPackagesUpdatedAt = useSelector(
    (s) => s.businessObjects?.workPackagesUpdatedAt
  );
  const workPackage = useLiveQuery(async () => {
    if (!enabled) return null;
    const rels = (
      await db.relsWorkPackageAnnotation
        .where("annotationId")
        .equals(annotation.id)
        .toArray()
    ).filter((r) => !r.deletedAt && r.listingId === listingId);
    if (rels.length === 0) return null;
    const wp = await db.workPackages.get(rels[0].workPackageId);
    return wp && !wp.deletedAt ? wp : null;
  }, [
    enabled,
    annotation?.id,
    listingId,
    relsUpdatedAt,
    workPackagesUpdatedAt,
  ]);

  // main

  return useMemo(() => {
    if (!enabled) return EMPTY;
    // no work package (or still loading) => no hours to attribute
    if (!workPackage) return EMPTY;
    // single-annotation quantities, same rollup rule as
    // accumulateAnnotationQties (unit count = its own count, else 1)
    const stats = {
      count: Number.isFinite(qties?.count) ? qties.count : 1,
      length: qties?.enabled ? (qties.lengthDeveloped ?? qties.length ?? 0) : 0,
      surface: qties?.enabled
        ? (qties.surfaceDeveloped ?? qties.surface ?? 0)
        : 0,
    };

    const covered = workPackage?.workStationIds?.length
      ? new Set(workPackage.workStationIds)
      : null;

    // soloed task filter (the task itself + its sub-tasks)
    const objects = businessObjects ?? [];
    const soloed =
      selectedTaskId && objects.some((o) => o.id === selectedTaskId)
        ? new Set([
            selectedTaskId,
            ...getBusinessObjectDescendants(objects, selectedTaskId).map(
              (o) => o.id
            ),
          ])
        : null;

    const tasks = buildBusinessObjectsTree(businessObjects ?? [])
      .map(({ businessObject }) => businessObject)
      .filter((task) => {
        if (task.isTitle) return false;
        if (soloed && !soloed.has(task.id)) return false;
        if (covered && !covered.has(task.id)) return false;
        // global layer = annotation partition (null = every annotation)
        return !task.globalLayerId || annotation.layerId === task.globalLayerId;
      })
      .map((task) => {
        const unit = getHoursRatioUnit(task);
        return {
          id: task.id,
          label: task.label,
          unit,
          qty: getBusinessObjectQtyValue(unit, stats),
          hoursRatio: isValidHoursRatio(task.hoursRatio)
            ? task.hoursRatio
            : null,
          hours: getBusinessObjectHoursBudget(task, stats),
        };
      });

    const budgeted = tasks.filter((t) => t.hours != null);
    return {
      tasks,
      workPackage: workPackage ?? null,
      total:
        budgeted.length > 0
          ? budgeted.reduce((sum, t) => sum + t.hours, 0)
          : null,
    };
  }, [
    enabled,
    annotation?.layerId,
    qties,
    businessObjects,
    workPackage,
    selectedTaskId,
  ]);
}
