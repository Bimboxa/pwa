import db from "App/db/db";

// Applies a quick-edit plan ({additions, updates, deletionIds} from
// buildQuickEditDiff) in ONE transaction: deletions cascade on their rels,
// additions are bulk-inserted, patches applied row by row. The caller
// dispatches the redux ticks once afterwards.
export default async function applyBusinessObjectsQuickEditService({ plan }) {
  const { additions = [], updates = [], deletionIds = [] } = plan ?? {};

  await db.transaction(
    "rw",
    db.businessObjects,
    db.relsBusinessObjectAnnotation,
    async () => {
      if (deletionIds.length > 0) {
        // soft-delete middleware sets deletedAt
        await db.businessObjects.bulkDelete(deletionIds);
        const rels = await db.relsBusinessObjectAnnotation
          .where("businessObjectId")
          .anyOf(deletionIds)
          .toArray();
        const relIds = rels.filter((r) => !r.deletedAt).map((r) => r.id);
        if (relIds.length > 0)
          await db.relsBusinessObjectAnnotation.bulkDelete(relIds);
      }

      if (additions.length > 0) {
        await db.businessObjects.bulkAdd(additions);
      }

      for (const { id, patch } of updates) {
        await db.businessObjects.update(id, patch);
      }
    }
  );
}
