import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function usePortfolios(options) {
  const scopeId = options?.filterByScopeId;

  const portfolios = useLiveQuery(async () => {
    if (!scopeId) return [];
    const records = await db.portfolios
      .where("scopeId")
      .equals(scopeId)
      .toArray();
    return records
      .filter((r) => !r.deletedAt)
      .sort((a, b) => {
        if (a.sortIndex == null && b.sortIndex == null) return 0;
        if (a.sortIndex == null) return -1;
        if (b.sortIndex == null) return 1;
        return a.sortIndex < b.sortIndex ? -1 : 1;
      });
  }, [scopeId]);

  return { value: portfolios };
}
