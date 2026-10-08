import db from "App/db/db";

import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";

import { PROMPT_IA_PROCEDURE_KEY } from "../utils/promptIaProcedure";

// Audit stamps of one import batch land within the same transaction; a user
// edit comes later than that.
const SAME_WRITE_TOLERANCE_MS = 2000;

const toTime = (iso) => (iso ? Date.parse(iso) : NaN);

/**
 * Was the annotation edited after the Prompt IA created it? Compares the
 * creation stamp with the newest updatedAt of the row and of its referenced
 * points (a vertex drag only touches db.points — same rule as the meshPaint
 * staleness check). An undo / redo re-stamps updatedAt and counts as an edit.
 */
export function isPromptIaOutputModified(annotation, pointById) {
  const createdAt = toTime(annotation.createdAt);
  if (!Number.isFinite(createdAt)) return false;
  let latest = toTime(annotation.updatedAt);
  for (const pointId of collectReferencedPointIds([annotation])) {
    const t = toTime(pointById.get(pointId)?.updatedAt);
    if (Number.isFinite(t) && !(t <= latest)) latest = t;
  }
  return (
    Number.isFinite(latest) && latest > createdAt + SAME_WRITE_TOLERANCE_MS
  );
}

/**
 * Live outputs of the Prompt IA on a listing / base map: the annotations
 * tagged `autoCreatedByProcedureKey: PROMPT_IA` (useApplyPromptIaOutput),
 * minus the ones the user edited since (kept by the sweep of the "Dessin
 * auto" band). Read fresh from Dexie at call time, like getProcedureOutputs.
 */
export default async function getPromptIaOutputs({ listingId, baseMapId }) {
  if (!listingId || !baseMapId) return [];
  const annotations = (
    await db.annotations.where("listingId").equals(listingId).toArray()
  ).filter(
    (a) =>
      !a.deletedAt &&
      a.baseMapId === baseMapId &&
      a.autoCreatedByProcedureKey === PROMPT_IA_PROCEDURE_KEY
  );
  if (annotations.length === 0) return [];
  const pointIds = [...collectReferencedPointIds(annotations)];
  const points = pointIds.length ? await db.points.bulkGet(pointIds) : [];
  const pointById = new Map(points.filter(Boolean).map((p) => [p.id, p]));
  return annotations.filter((a) => !isPromptIaOutputModified(a, pointById));
}
