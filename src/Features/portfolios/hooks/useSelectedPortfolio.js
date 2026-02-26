import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import db from "App/db/db";

export default function useSelectedPortfolio() {
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems.find((i) => i.type === "PORTFOLIO");
  const id = selectedItem?.id;

  const portfolio = useLiveQuery(async () => {
    if (!id) return null;
    const record = await db.listings.get(id);
    if (!record || record.deletedAt) return null;
    return record;
  }, [id]);

  return { value: portfolio };
}
