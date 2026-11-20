import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { isBlockMemberAnnotation } from "../utils/blockTypes";

// Blocks base maps holding the annotations (members) of a block, as
// [{id, name, membersCount}] sorted by name — the origin base map first.
// undefined while loading.
export default function useBlockMemberBaseMaps(block) {
  const blockId = block?.id ?? null;
  const originBaseMapId = block?.origin?.baseMapId ?? null;

  return useLiveQuery(async () => {
    if (!blockId) return [];
    const members = (
      await db.annotations.where("blockId").equals(blockId).toArray()
    ).filter((a) => !a.deletedAt && isBlockMemberAnnotation(a));

    const countById = {};
    members.forEach((a) => {
      if (!a.baseMapId) return;
      countById[a.baseMapId] = (countById[a.baseMapId] ?? 0) + 1;
    });
    const ids = Object.keys(countById);
    if (originBaseMapId && !countById[originBaseMapId])
      ids.push(originBaseMapId);

    const records = (await db.baseMaps.bulkGet(ids)).filter(
      (r) => r && !r.deletedAt
    );
    return records
      .map((r) => ({
        id: r.id,
        name: r.name ?? "",
        membersCount: countById[r.id] ?? 0,
      }))
      .sort(
        (a, b) =>
          (b.id === originBaseMapId) - (a.id === originBaseMapId) ||
          a.name.localeCompare(b.name)
      );
  }, [blockId, originBaseMapId]);
}
