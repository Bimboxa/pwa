import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function usePortfolioPages(options) {
  const portfolioId = options?.filterByPortfolioId;

  const pages = useLiveQuery(async () => {
    if (!portfolioId) return [];
    const records = await db.portfolioPages
      .where("portfolioId")
      .equals(portfolioId)
      .toArray();
    return records
      .filter((r) => !r.deletedAt)
      .sort((a, b) => {
        if (a.sortIndex == null && b.sortIndex == null) return 0;
        if (a.sortIndex == null) return -1;
        if (b.sortIndex == null) return 1;
        return a.sortIndex < b.sortIndex ? -1 : 1;
      });
  }, [portfolioId]);

  return { value: pages };
}
