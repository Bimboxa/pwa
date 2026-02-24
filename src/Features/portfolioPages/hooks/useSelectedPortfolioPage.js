import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import db from "App/db/db";

export default function useSelectedPortfolioPage() {
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems.find(
    (i) => i.type === "PORTFOLIO_PAGE"
  );
  const id = selectedItem?.id;

  const page = useLiveQuery(async () => {
    if (!id) return null;
    const record = await db.portfolioPages.get(id);
    if (!record || record.deletedAt) return null;
    return record;
  }, [id]);

  return { value: page };
}
