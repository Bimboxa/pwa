import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import {
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_STEP_HOURS,
  DEFAULT_TIME_AXIS_MODE,
  MAX_STEP_HOURS,
  MIN_STEP_HOURS,
} from "../constants/planningDefaults";
import { normalizeStartDate } from "../utils/planningTimeAxis";

// Write services of the time planning (plannings / planningResources /
// planningSlots). Plain async functions: the callers dispatch ONE
// triggerPlanningUpdate per call (usePlanningActions).

const lastSortIndexOf = (rows) =>
  rows
    .map((r) => r.sortIndex)
    .filter((s) => s != null)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .pop() ?? null;

export async function createPlanningService({ listing }) {
  const existing = (
    await db.plannings.where("listingId").equals(listing.id).toArray()
  ).filter((p) => !p.deletedAt);
  const planning = {
    id: nanoid(),
    listingId: listing.id,
    projectId: listing.projectId,
    scopeId: listing.scopeId,
    label: existing.length > 0 ? `Planning ${existing.length + 1}` : "Planning",
    timeAxisMode: DEFAULT_TIME_AXIS_MODE,
    stepHours: DEFAULT_STEP_HOURS,
    hoursPerDay: DEFAULT_HOURS_PER_DAY,
    startDate: normalizeStartDate(null),
    currentStep: 0,
    sortIndex: generateKeyBetween(lastSortIndexOf(existing), null),
  };
  await db.plannings.add(planning);
  return planning;
}

export async function updatePlanningService(
  planningId,
  { label, timeAxisMode, stepHours, startDate, currentStep } = {}
) {
  const updates = {};
  if (label != null) updates.label = label;
  if (timeAxisMode === "CALENDAR" || timeAxisMode === "STEPS")
    updates.timeAxisMode = timeAxisMode;
  if (Number.isFinite(stepHours))
    updates.stepHours = Math.min(
      MAX_STEP_HOURS,
      Math.max(MIN_STEP_HOURS, Math.round(stepHours))
    );
  if (startDate != null) updates.startDate = normalizeStartDate(startDate);
  if (Number.isFinite(currentStep))
    updates.currentStep = Math.max(0, currentStep);
  if (Object.keys(updates).length === 0) return;
  await db.plannings.update(planningId, updates);
}

export async function createPlanningResourceService({ planning, label }) {
  const existing = (
    await db.planningResources.where("planningId").equals(planning.id).toArray()
  ).filter((r) => !r.deletedAt);
  const resource = {
    id: nanoid(),
    planningId: planning.id,
    listingId: planning.listingId,
    projectId: planning.projectId,
    scopeId: planning.scopeId,
    label: label || `Compagnon ${existing.length + 1}`,
    sortIndex: generateKeyBetween(lastSortIndexOf(existing), null),
  };
  await db.planningResources.add(resource);
  return resource;
}

export async function updatePlanningResourceService(
  resourceId,
  { label } = {}
) {
  if (label == null) return;
  await db.planningResources.update(resourceId, { label });
}

// direction: -1 (up) | +1 (down) among the planning's resources.
export async function movePlanningResourceService(resourceId, direction) {
  const resource = await db.planningResources.get(resourceId);
  if (!resource || resource.deletedAt) return;
  const siblings = (
    await db.planningResources
      .where("planningId")
      .equals(resource.planningId)
      .toArray()
  )
    .filter((r) => !r.deletedAt)
    .sort((a, b) =>
      String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
    );
  const idx = siblings.findIndex((r) => r.id === resourceId);
  const targetIdx = idx + direction;
  if (idx === -1 || targetIdx < 0 || targetIdx >= siblings.length) return;
  const target = siblings[targetIdx];
  let sortIndex;
  if (direction < 0) {
    const prev = siblings[targetIdx - 1];
    sortIndex = generateKeyBetween(prev?.sortIndex ?? null, target.sortIndex);
  } else {
    const next = siblings[targetIdx + 1];
    sortIndex = generateKeyBetween(target.sortIndex, next?.sortIndex ?? null);
  }
  await db.planningResources.update(resourceId, { sortIndex });
}

// Deletes a resource with its blocks (one transaction).
export async function deletePlanningResourceService(resourceId) {
  await db.transaction(
    "rw",
    db.planningResources,
    db.planningSlots,
    async () => {
      const slots = (
        await db.planningSlots
          .where("planningResourceId")
          .equals(resourceId)
          .toArray()
      ).filter((s) => !s.deletedAt);
      if (slots.length > 0)
        await db.planningSlots.bulkDelete(slots.map((s) => s.id));
      await db.planningResources.delete(resourceId);
    }
  );
}

export async function createPlanningSlotService({
  planning,
  planningResourceId,
  workPackageId,
  startStep,
  steps = 1,
}) {
  const slot = {
    id: nanoid(),
    planningId: planning.id,
    planningResourceId,
    workPackageId,
    listingId: planning.listingId,
    projectId: planning.projectId,
    scopeId: planning.scopeId,
    startStep: Math.max(0, Math.round(startStep ?? 0)),
    steps: Math.max(1, Math.round(steps)),
  };
  await db.planningSlots.add(slot);
  return slot;
}

export async function updatePlanningSlotService(
  slotId,
  { startStep, steps, planningResourceId, workPackageId } = {}
) {
  const updates = {};
  if (Number.isFinite(startStep))
    updates.startStep = Math.max(0, Math.round(startStep));
  if (Number.isFinite(steps)) updates.steps = Math.max(1, Math.round(steps));
  if (planningResourceId) updates.planningResourceId = planningResourceId;
  if (workPackageId) updates.workPackageId = workPackageId;
  if (Object.keys(updates).length === 0) return;
  await db.planningSlots.update(slotId, updates);
}

export async function deletePlanningSlotService(slotId) {
  await db.planningSlots.delete(slotId);
}
