import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

// Paints written by an automated procedure (« Quantités clé »): the rows
// carry `autoCreatedByProcedureKey` / `autoCreatedFrom` like procedure
// annotations do, so a new run SWEEPS the previous ones of the same sources
// before writing — ONE undo step (soft delete through the middleware, then
// the new rows). getProcedureOutputs knows annotations only: the sweep of
// the paints is this service's.
//
// Throws what the db guards throw (read-only scope): the caller reports it.

const isLive = (row) => row && !row.deletedAt;

/**
 * @param {object} args
 * @param {string} args.projectId
 * @param {string} args.procedureKey
 * @param {string[]} args.sourceAnnotationIds sources of the run (the
 *   `autoCreatedFrom` of the rows to sweep and of the rows to write)
 * @param {Array} args.rows db.meshPaints rows to add (tagged by the caller)
 * @returns {Promise<{deleted: number, added: number}>}
 */
export default async function writeProcedureMeshPaintsService({
  projectId,
  procedureKey,
  sourceAnnotationIds,
  rows,
}) {
  const sources = new Set((sourceAnnotationIds ?? []).filter(Boolean));
  const toAdd = (rows ?? []).filter((row) => row?.id);
  let deleted = 0;
  await withUndoGroup(() =>
    db.transaction("rw", db.meshPaints, async () => {
      if (projectId && procedureKey && sources.size) {
        const previous = (
          await db.meshPaints.where("projectId").equals(projectId).toArray()
        ).filter(
          (row) =>
            isLive(row) &&
            row.autoCreatedByProcedureKey === procedureKey &&
            sources.has(row.autoCreatedFrom)
        );
        if (previous.length) {
          await db.meshPaints.bulkDelete(previous.map((row) => row.id));
          deleted = previous.length;
        }
      }
      if (toAdd.length) await db.meshPaints.bulkAdd(toAdd);
    })
  );
  return { deleted, added: toAdd.length };
}
