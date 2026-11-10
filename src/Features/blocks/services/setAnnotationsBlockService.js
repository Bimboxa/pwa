import db from "App/db/db";

import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";

import getNormalizedPointsCenter from "../utils/getNormalizedPointsCenter";
import { isBlockInstanceAnnotation } from "../utils/blockTypes";

// Links annotations drawn ON a blocks base map to a block (`blockId`), or
// unlinks them (blockId null). No geometry change.
// A block with no origin yet takes the center of the linked annotations as
// its insertion point; the origin then stays put when members are edited.
// One transaction. Returns the ids actually written.
export default async function setAnnotationsBlockService({
  annotationIds,
  blockId,
}) {
  const ids = [...new Set(annotationIds ?? [])].filter(Boolean);
  if (ids.length === 0) return [];

  return db.transaction(
    "rw",
    [db.annotations, db.points, db.blocks, db.baseMaps],
    async () => {
      const rows = (await db.annotations.bulkGet(ids)).filter(
        (a) => a && !a.deletedAt && !isBlockInstanceAnnotation(a)
      );
      if (rows.length === 0) return [];

      // members live on blocks base maps only
      const baseMapIds = [...new Set(rows.map((a) => a.baseMapId))];
      const baseMaps = await db.baseMaps.bulkGet(baseMapIds);
      const blocksBaseMapIds = new Set(
        baseMaps.filter((b) => b?.isBlocksBaseMap && !b.deletedAt).map((b) => b.id)
      );
      const members = rows.filter((a) => blocksBaseMapIds.has(a.baseMapId));
      if (members.length === 0) return [];

      await Promise.all(
        members.map((a) =>
          db.annotations.update(a.id, { blockId: blockId ?? null })
        )
      );

      if (blockId) {
        const block = await db.blocks.get(blockId);
        if (block && !block.origin) {
          // the origin lives on ONE base map: the first member's
          const originBaseMapId = members[0].baseMapId;
          const pointIds = collectReferencedPointIds(
            members.filter((a) => a.baseMapId === originBaseMapId)
          );
          const points = (await db.points.bulkGet([...pointIds])).filter(
            (p) => p && !p.deletedAt
          );
          const center = getNormalizedPointsCenter(points);
          if (center) {
            await db.blocks.update(blockId, {
              origin: { baseMapId: originBaseMapId, x: center.x, y: center.y, z: 0 },
            });
          }
        }
      }

      return members.map((a) => a.id);
    }
  );
}
