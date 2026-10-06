import db from "App/db/db";

/**
 * Live outputs of an ANNOTATIONS_CREATOR procedure run from a set of source
 * annotations: every annotation of the PROJECT tagged `autoCreatedFrom` with
 * one of the sources AND `autoCreatedByProcedureKey` with this procedure
 * (legacy rows without a procedure key match any procedure, so procedure A
 * never sweeps what procedure B created from the same source).
 *
 * Project-wide, not source-base-map-wide: a procedure may output on another
 * map (the revolution-section systems draw on the vertical page from a plan
 * axis) and a reset must still find those rows.
 *
 * Read fresh from Dexie at call time — never from React state — so a reset
 * launched right before a re-run sweeps exactly the rows alive at that
 * moment. Shared by the launcher buttons (count + reset / refresh) and the
 * auto-launch outlet (replace-on-rerun).
 */
export default async function getProcedureOutputs({
  projectId,
  procedureKey,
  sourceAnnotationIds,
}) {
  const sourceIds = sourceAnnotationIds ?? [];
  if (!projectId || sourceIds.length === 0) return [];
  const sourceIdSet = new Set(sourceIds);
  const all = await db.annotations
    .where("projectId")
    .equals(projectId)
    .toArray();
  return all.filter(
    (a) =>
      !a.deletedAt &&
      sourceIdSet.has(a.autoCreatedFrom) &&
      (!a.autoCreatedByProcedureKey ||
        a.autoCreatedByProcedureKey === procedureKey)
  );
}
