import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import db from "App/db/db";

export default function useSelectedBaseMapContainer() {
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems.find(
    (i) => i.type === "BASE_MAP_CONTAINER"
  );
  const id = selectedItem?.id;

  const container = useLiveQuery(async () => {
    if (!id) return null;
    const record = await db.portfolioBaseMapContainers.get(id);
    if (!record || record.deletedAt) return null;
    return record;
  }, [id]);

  return { value: container };
}
