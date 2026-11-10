import { useDispatch, useSelector } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import db from "App/db/db";

import createBlocksBaseMapService from "../services/createBlocksBaseMapService";

// Opens (selects as main base map) the blocks base map where a block is
// drawn: its origin base map, else its first member's, else the first blocks
// base map of the project — created when the project has none yet.
// Returns async ({block?, baseMapId?, createNew?}) => baseMapId | null.
export default function useOpenBlocksBaseMap() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // helpers

  async function findLiveBlocksBaseMapId(candidateIds) {
    for (const id of candidateIds) {
      if (!id) continue;
      const record = await db.baseMaps.get(id);
      if (record?.isBlocksBaseMap && !record.deletedAt) return record.id;
    }
    return null;
  }

  // main

  return async function openBlocksBaseMap({ block, baseMapId, createNew } = {}) {
    if (!projectId) return null;

    let targetId = createNew
      ? null
      : await findLiveBlocksBaseMapId([
          baseMapId,
          block?.origin?.baseMapId,
          block?.memberBaseMapId,
        ]);

    if (!targetId && !createNew) {
      const first = (
        await db.baseMaps.where("projectId").equals(projectId).toArray()
      )
        .filter((r) => r.isBlocksBaseMap && !r.deletedAt)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))[0];
      targetId = first?.id ?? null;
    }

    if (!targetId) {
      const record = await createBlocksBaseMapService({ projectId });
      targetId = record.id;
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
    }

    dispatch(setSelectedMainBaseMapId(targetId));
    return targetId;
  };
}
