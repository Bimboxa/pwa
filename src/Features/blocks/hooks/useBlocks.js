import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { isBlockInstanceAnnotation } from "../utils/blockTypes";

// Blocks of the selected scope, sorted by label, each with its usage:
// {...block, membersCount, instancesCount, memberBaseMapId}.
// `memberBaseMapId`: base map of the first member (where the block is drawn
// when it has no origin yet).
export default function useBlocks() {
  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // main

  return useLiveQuery(async () => {
    if (!scopeId) return [];
    const blocks = (
      await db.blocks.where("scopeId").equals(scopeId).toArray()
    ).filter((b) => !b.deletedAt);
    if (blocks.length === 0) return [];

    const ids = blocks.map((b) => b.id);
    const [memberRows, instanceRows] = await Promise.all([
      db.annotations.where("blockId").anyOf(ids).toArray(),
      db.annotations.where("instanceOfBlockId").anyOf(ids).toArray(),
    ]);

    const usageById = {};
    ids.forEach((id) => {
      usageById[id] = {
        membersCount: 0,
        instancesCount: 0,
        memberBaseMapId: null,
      };
    });
    memberRows.forEach((a) => {
      if (a.deletedAt || isBlockInstanceAnnotation(a)) return;
      const usage = usageById[a.blockId];
      usage.membersCount += 1;
      if (!usage.memberBaseMapId) usage.memberBaseMapId = a.baseMapId;
    });
    instanceRows.forEach((a) => {
      if (a.deletedAt) return;
      usageById[a.instanceOfBlockId].instancesCount += 1;
    });

    return blocks
      .map((b) => ({ ...b, ...usageById[b.id] }))
      .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }, [scopeId]);
}
