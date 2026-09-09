import { useMemo } from "react";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useWorkPackages from "./useWorkPackages";
import useRelsWorkPackageAnnotation from "./useRelsWorkPackageAnnotation";
import useBusinessObjects from "./useBusinessObjects";

import accumulateAnnotationQties, {
  createEmptyQties,
} from "../utils/accumulateAnnotationQties";
import buildBusinessObjectsTree from "../utils/buildBusinessObjectsTree";
import getBusinessObjectHoursBudget from "../utils/getBusinessObjectHoursBudget";
import getBusinessObjectQtyValue from "../utils/getBusinessObjectQtyValue";
import getHoursRatioUnit from "../utils/getHoursRatioUnit";
import { isValidHoursRatio } from "../utils/hoursRatioConversions";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const EMPTY = {
  workPackages: [],
  annotationsByWorkPackageId: {},
  annotationCountByWorkPackageId: {},
  tasksByWorkPackageId: {},
  budgetByWorkPackageId: {},
  hoursByWorkPackageIdByTaskId: {},
  totalByTaskId: {},
  grandTotal: 0,
};

// Applicability of a task to an annotation: the task's global layer is a
// partition filter (null = every annotation of the package).
export function taskAppliesToAnnotation(task, annotation) {
  return !task?.globalLayerId || annotation?.layerId === task.globalLayerId;
}

// Hours of the work packages of a PLANNING listing. A package's tasks are
// the ones it covers (workStationIds; EMPTY = every task of the listing),
// kept when at least one of the package's linked annotations matches them
// through their global layer; the task's hours in the package = quantity of
// the matching annotations in the task's ratio unit × ratio (null without a
// valid ratio). Also the per-task totals over every package (the
// "% planifié" denominator).
export default function useWorkPackageHours({ listingId } = {}) {
  const { value: workPackages } = useWorkPackages({ listingId });
  const { value: rels } = useRelsWorkPackageAnnotation({ listingId });
  const { value: businessObjects } = useBusinessObjects({ listingId });

  const annotations = useAnnotationsV2({
    caller: "useWorkPackageHours",
    withQties: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    filterBySelectedScope: true,
    enabled: Boolean(listingId),
  });

  return useMemo(() => {
    if (!listingId) return EMPTY;
    const annotationById = getItemsByKey(annotations ?? [], "id");
    const tasks = buildBusinessObjectsTree(businessObjects ?? [])
      .map(({ businessObject }) => businessObject)
      .filter((o) => !o.isTitle);

    const annotationsByWorkPackageId = {};
    rels.forEach((rel) => {
      const a = annotationById[rel.annotationId];
      if (!a) return;
      if (!annotationsByWorkPackageId[rel.workPackageId])
        annotationsByWorkPackageId[rel.workPackageId] = [];
      annotationsByWorkPackageId[rel.workPackageId].push(a);
    });

    const annotationCountByWorkPackageId = {};
    const tasksByWorkPackageId = {};
    const budgetByWorkPackageId = {};
    const hoursByWorkPackageIdByTaskId = {};
    const totalByTaskId = {};
    let grandTotal = 0;

    workPackages.forEach((wp) => {
      const anns = annotationsByWorkPackageId[wp.id] ?? [];
      annotationCountByWorkPackageId[wp.id] = anns.length;
      const entries = [];
      let budget = null;
      hoursByWorkPackageIdByTaskId[wp.id] = {};
      // covered tasks: the package's own selection, or all of them
      const covered = wp.workStationIds?.length
        ? new Set(wp.workStationIds)
        : null;
      tasks.forEach((task) => {
        if (covered && !covered.has(task.id)) return;
        const matching = anns.filter(
          (a) => !a.isMeshCell && taskAppliesToAnnotation(task, a)
        );
        if (matching.length === 0) return;
        const qties = createEmptyQties();
        matching.forEach((a) => accumulateAnnotationQties(qties, a));
        const unit = getHoursRatioUnit(task);
        const hours = getBusinessObjectHoursBudget(task, qties);
        entries.push({
          businessObjectId: task.id,
          label: task.label,
          unit,
          qty: getBusinessObjectQtyValue(unit, qties),
          hoursRatio: isValidHoursRatio(task.hoursRatio)
            ? task.hoursRatio
            : null,
          hours,
          count: matching.length,
        });
        if (hours != null) {
          budget = (budget ?? 0) + hours;
          hoursByWorkPackageIdByTaskId[wp.id][task.id] = hours;
          totalByTaskId[task.id] = (totalByTaskId[task.id] ?? 0) + hours;
        }
      });
      tasksByWorkPackageId[wp.id] = entries;
      budgetByWorkPackageId[wp.id] = budget;
      if (budget != null) grandTotal += budget;
    });

    return {
      workPackages,
      annotationsByWorkPackageId,
      annotationCountByWorkPackageId,
      tasksByWorkPackageId,
      budgetByWorkPackageId,
      hoursByWorkPackageIdByTaskId,
      totalByTaskId,
      grandTotal,
    };
  }, [listingId, workPackages, rels, businessObjects, annotations]);
}
