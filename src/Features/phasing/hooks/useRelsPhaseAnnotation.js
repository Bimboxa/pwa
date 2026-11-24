import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

const EMPTY = [];

// Live db.relsPhaseAnnotation rows of a PHASING listing (nothing => empty).
export default function useRelsPhaseAnnotation({ listingId } = {}) {
  const relsUpdatedAt = useSelector((s) => s.phasing.relsPhaseUpdatedAt);

  const rows = useLiveQuery(async () => {
    if (!listingId) return [];
    const all = await db.relsPhaseAnnotation
      .where("listingId")
      .equals(listingId)
      .toArray();
    return all.filter((r) => !r.deletedAt);
  }, [listingId, relsUpdatedAt]);

  const value = useMemo(() => rows ?? EMPTY, [rows]);
  return { value, loading: rows === undefined };
}
