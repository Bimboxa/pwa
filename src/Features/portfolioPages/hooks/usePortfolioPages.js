import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function usePortfolioPages(options) {
  const listingId = options?.filterByPortfolioId || options?.filterByListingId;

  const pages = useLiveQuery(async () => {
    if (!listingId) return [];
    const records = await db.portfolioPages
      .where("listingId")
      .equals(listingId)
      .toArray();
    return records
      .filter((r) => !r.deletedAt)
      .sort((a, b) => {
        if (a.sortIndex == null && b.sortIndex == null) return 0;
        if (a.sortIndex == null) return -1;
        if (b.sortIndex == null) return 1;
        return a.sortIndex < b.sortIndex ? -1 : 1;
      });
  }, [listingId]);

  return { value: pages };
}
