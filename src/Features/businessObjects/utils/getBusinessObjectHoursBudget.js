import getBusinessObjectQtyValue from "./getBusinessObjectQtyValue";
import getHoursRatioUnit from "./getHoursRatioUnit";
import { isValidHoursRatio } from "./hoursRatioConversions";

// Own hours budget of a task = quantity of its linked annotations in the
// task's RATIO unit (hoursRatioUnit, not the articles' quantity unit) ×
// hoursRatio (hours per unit). null without a valid ratio or without linked
// quantities.
export default function getBusinessObjectHoursBudget(businessObject, qties) {
  if (!isValidHoursRatio(businessObject?.hoursRatio)) return null;
  const qty = getBusinessObjectQtyValue(getHoursRatioUnit(businessObject), qties);
  return qty == null ? null : qty * businessObject.hoursRatio;
}

// Hierarchical roll-up over parentId: totalById[id] = own budget + Σ of the
// descendants' totals (bottom-up, memoized, cycle guard like the solo
// rollup of BusinessObjectsTree). Orphans (missing parent) count as roots,
// like buildBusinessObjectsTree. null entries = nothing to sum (no ratio and
// no budgeted descendant); grandTotal sums the roots.
export function getHoursBudgetByObjectId(businessObjects, qtiesByObjectId) {
  const objects = businessObjects ?? [];
  const ids = new Set(objects.map((o) => o.id));
  const childrenByParentId = {};
  const roots = [];
  objects.forEach((o) => {
    const parentId = o.parentId && ids.has(o.parentId) ? o.parentId : null;
    if (parentId === null) {
      roots.push(o);
    } else {
      if (!childrenByParentId[parentId]) childrenByParentId[parentId] = [];
      childrenByParentId[parentId].push(o);
    }
  });

  const ownById = {};
  const totalById = {};
  const visit = (o) => {
    if (o.id in totalById) return totalById[o.id];
    totalById[o.id] = null; // cycle guard
    const own = getBusinessObjectHoursBudget(o, qtiesByObjectId?.[o.id]);
    ownById[o.id] = own;
    let total = own;
    (childrenByParentId[o.id] ?? []).forEach((child) => {
      const childTotal = visit(child);
      if (childTotal != null) total = (total ?? 0) + childTotal;
    });
    totalById[o.id] = total;
    return total;
  };
  objects.forEach(visit);

  const grandTotal = roots.reduce((sum, r) => sum + (totalById[r.id] ?? 0), 0);
  return { ownById, totalById, grandTotal };
}
