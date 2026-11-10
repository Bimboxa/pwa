import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

// Deletes a block: its instances go with it (they would render nothing), its
// members stay on their blocks base map, unlinked. One transaction, one undo
// step.
export default async function deleteBlockService({ blockId }) {
  if (!blockId) return;
  await withUndoGroup(() =>
    db.transaction("rw", [db.annotations, db.blocks], async () => {
      const instanceIds = await db.annotations
        .where("instanceOfBlockId")
        .equals(blockId)
        .primaryKeys();
      if (instanceIds.length > 0) await db.annotations.bulkDelete(instanceIds);

      const memberIds = await db.annotations
        .where("blockId")
        .equals(blockId)
        .primaryKeys();
      await Promise.all(
        memberIds.map((id) => db.annotations.update(id, { blockId: null }))
      );

      await db.blocks.delete(blockId);
    })
  );
}
