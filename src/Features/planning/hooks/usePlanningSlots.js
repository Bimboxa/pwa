import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

const EMPTY = [];

// Blocks of a planning. planningId null => empty.
export default function usePlanningSlots({ planningId } = {}) {
  const planningUpdatedAt = useSelector((s) => s.planning.planningUpdatedAt);

  const rows = useLiveQuery(async () => {
    if (!planningId) return [];
    const all = await db.planningSlots
      .where("planningId")
      .equals(planningId)
      .toArray();
    return all.filter((s) => !s.deletedAt);
  }, [planningId, planningUpdatedAt]);

  const value = useMemo(() => rows ?? EMPTY, [rows]);
  return { value, loading: rows === undefined };
}
