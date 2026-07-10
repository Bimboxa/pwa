import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { selectSelectedItems } from "Features/selection/selectionSlice";

// Resolves the current selection into the list of selected maille records
// (selection items with nodeType MESH3D). Returns [] when none.
export default function useSelectedMeshes3d() {
  const selectedItems = useSelector(selectSelectedItems);
  const idsKey = selectedItems
    .filter((it) => it?.type === "NODE" && it?.nodeType === "MESH3D")
    .map((it) => it.nodeId)
    .join(",");

  return useLiveQuery(
    async () => {
      if (!idsKey) return [];
      const records = await db.meshes3d.bulkGet(idsKey.split(","));
      return records.filter((r) => r && !r.deletedAt);
    },
    [idsKey],
    []
  );
}
