import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Live single-POV read. Returns "loading" until the query resolves so callers
// can distinguish a pending read from a hard-deleted record (undefined).
export default function usePov(povId) {
  return useLiveQuery(
    async () => (povId ? db.povs.get(povId) : undefined),
    [povId],
    "loading"
  );
}
