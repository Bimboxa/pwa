import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// The time planning of a PLANNING listing (one per listing in v1: the first
// non-deleted row by sortIndex). listingId null => null.
export default function usePlanningOfListing({ listingId } = {}) {
  const planningUpdatedAt = useSelector((s) => s.planning.planningUpdatedAt);

  const planning = useLiveQuery(async () => {
    if (!listingId) return null;
    const rows = (
      await db.plannings.where("listingId").equals(listingId).toArray()
    ).filter((p) => !p.deletedAt);
    rows.sort((a, b) =>
      String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
    );
    return rows[0] ?? null;
  }, [listingId, planningUpdatedAt]);

  return { value: planning ?? null, loading: planning === undefined };
}
