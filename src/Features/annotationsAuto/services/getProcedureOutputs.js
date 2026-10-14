import db from "App/db/db";

/**
 * Live outputs of an ANNOTATIONS_CREATOR procedure run from a set of source
 * annotations: every annotation of the PROJECT tagged `autoCreatedFrom` with
 * one of the sources AND `autoCreatedByProcedureKey` with this procedure
 * (legacy rows without a procedure key match any procedure, so procedure A
 * never sweeps what procedure B created from the same source).
 *
 * Chained procedures (registry `chainedProcedureKeys`, e.g. the château d'eau
 * surfaces drawn on top of the château d'eau walls): the outputs of a chained
 * procedure built FROM this procedure's outputs (their `autoCreatedFrom` is
 * one of them) OR from the same sources (the surfaces launched from their
 * own listing are tagged with the axis, like the walls) are swept along —
 * they would be stale once the walls are redrawn. Cascades through the chain
 * (a chained procedure's own chain too).
 *
 * Project-wide, not source-base-map-wide: a procedure may output on another
 * map (the revolution-section systems draw on the vertical page from a plan
 * axis) and a reset must still find those rows.
 *
 * Read fresh from Dexie at call time — never from React state — so a reset
 * launched right before a re-run sweeps exactly the rows alive at that
 * moment. Shared by the launcher buttons (count + reset / refresh), the
 * listing « Dessin auto » band and the auto-launch outlet (replace-on-rerun).
 */
export default async function getProcedureOutputs({
  projectId,
  procedureKey,
  sourceAnnotationIds,
  chainedProcedureKeys = null,
  procedures = null,
}) {
  const sourceIds = sourceAnnotationIds ?? [];
  if (!projectId || sourceIds.length === 0) return [];
  const all = (
    await db.annotations.where("projectId").equals(projectId).toArray()
  ).filter((a) => !a.deletedAt);

  // legacy rows without a procedure key match the procedure itself only —
  // never a chained level (an untagged row built on an output is not ours)
  const outputsOf = (key, ids, exact) => {
    const idSet = new Set(ids);
    return all.filter(
      (a) =>
        idSet.has(a.autoCreatedFrom) &&
        (a.autoCreatedByProcedureKey === key ||
          (!exact && !a.autoCreatedByProcedureKey))
    );
  };
  const chainOf = (key) =>
    key === procedureKey && chainedProcedureKeys
      ? chainedProcedureKeys
      : ((procedures ?? []).find((p) => p.key === key)?.chainedProcedureKeys ??
        []);

  const outputs = outputsOf(procedureKey, sourceIds, false);
  const seen = new Set(outputs.map((a) => a.id));
  // breadth-first through the chain: each level's outputs (plus the original
  // sources) source the next
  const queue = [{ key: procedureKey, rows: [...outputs] }];
  while (queue.length > 0) {
    const level = queue.shift();
    const chained = chainOf(level.key);
    if (chained.length === 0) continue;
    const ids = [...level.rows.map((a) => a.id), ...sourceIds];
    for (const key of chained) {
      const rows = outputsOf(key, ids, true).filter((a) => !seen.has(a.id));
      for (const a of rows) {
        seen.add(a.id);
        outputs.push(a);
      }
      queue.push({ key, rows });
    }
  }
  return outputs;
}
