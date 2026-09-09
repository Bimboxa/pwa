import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

const EMPTY = [];

// Rows ("Compagnon n") of a planning, sorted by sortIndex.
export default function usePlanningResources({ planningId } = {}) {
  const planningUpdatedAt = useSelector((s) => s.planning.planningUpdatedAt);

  const rows = useLiveQuery(async () => {
    if (!planningId) return [];
    const all = await db.planningResources
      .where("planningId")
      .equals(planningId)
      .toArray();
    return all.filter((r) => !r.deletedAt);
  }, [planningId, planningUpdatedAt]);

  const value = useMemo(() => {
    if (!rows?.length) return EMPTY;
    return [...rows].sort((a, b) =>
      String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
    );
  }, [rows]);

  return { value, loading: rows === undefined };
}
