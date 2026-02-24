import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

export default function useDisplayedPortfolio() {
  const id = useSelector((s) => s.portfolios.displayedPortfolioId);

  const portfolio = useLiveQuery(async () => {
    if (!id) return null;
    const record = await db.portfolios.get(id);
    if (!record || record.deletedAt) return null;
    return record;
  }, [id]);

  return { value: portfolio };
}
