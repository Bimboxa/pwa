import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { selectSelectedItems } from "Features/selection/selectionSlice";

// Resolves the current selection into a dimension ("cote") record when the
// single selected item is a DIMENSION node. Returns null otherwise. Mirrors
// the useSelectedAnnotation resolver pattern but reads db.dimensions3d.
export default function useSelectedDimension3d() {
  const selectedItems = useSelector(selectSelectedItems);
  const item = selectedItems.length === 1 ? selectedItems[0] : null;
  const isDimension =
    item?.type === "NODE" && item?.nodeType === "DIMENSION" && item?.nodeId;
  const dimensionId = isDimension ? item.nodeId : null;

  return useLiveQuery(async () => {
    if (!dimensionId) return null;
    const record = await db.dimensions3d.get(dimensionId);
    return record && !record.deletedAt ? record : null;
  }, [dimensionId]);
}
