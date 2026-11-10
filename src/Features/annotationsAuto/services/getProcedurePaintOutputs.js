import db from "App/db/db";

// A procedure may write PAINTED PARTS (db.meshPaints, « Pinceau ») instead
// of — or besides — annotations: its registry entry says so with
// `outputKind: "MESH_PAINTS"` (e.g. the pool « Quantités clé »). The rows
// carry the same tags as procedure annotations (`autoCreatedByProcedureKey`,
// `autoCreatedFrom` = a source annotation id — see
// meshPaint/services/writeProcedureMeshPaintsService).

export function procedureWritesPaints(procedure) {
  return procedure?.outputKind === "MESH_PAINTS";
}

/**
 * Live painted parts written by a procedure run from a set of source
 * annotations — the paint counterpart of getProcedureOutputs. Project-wide
 * (a paint lives on its host's base map, not on the source's). Read fresh
 * from Dexie at call time.
 *
 * @returns {Promise<Array>} db.meshPaints rows
 */
export default async function getProcedurePaintOutputs({
  projectId,
  procedureKey,
  sourceAnnotationIds,
}) {
  const sourceIds = new Set((sourceAnnotationIds ?? []).filter(Boolean));
  if (!projectId || !procedureKey || sourceIds.size === 0 || !db.meshPaints) {
    return [];
  }
  return (
    await db.meshPaints.where("projectId").equals(projectId).toArray()
  ).filter(
    (row) =>
      !row.deletedAt &&
      row.autoCreatedByProcedureKey === procedureKey &&
      sourceIds.has(row.autoCreatedFrom)
  );
}
