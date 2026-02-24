import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function usePortfolioBaseMapContainers(options) {
  const pageId = options?.filterByPageId;

  const containers = useLiveQuery(async () => {
    if (!pageId) return [];
    const records = await db.portfolioBaseMapContainers
      .where("portfolioPageId")
      .equals(pageId)
      .toArray();
    return records
      .filter((r) => !r.deletedAt)
      .sort((a, b) => {
        if (a.sortIndex == null && b.sortIndex == null) return 0;
        if (a.sortIndex == null) return -1;
        if (b.sortIndex == null) return 1;
        return a.sortIndex < b.sortIndex ? -1 : 1;
      });
  }, [pageId]);

  return { value: containers };
}
