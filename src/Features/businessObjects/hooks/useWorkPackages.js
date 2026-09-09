import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

const EMPTY = [];

// Work packages of a PLANNING listing, sorted by sortIndex. listingId null
// => empty (unconditional hook calls).
export default function useWorkPackages({ listingId } = {}) {
  const workPackagesUpdatedAt = useSelector(
    (s) => s.businessObjects.workPackagesUpdatedAt
  );

  const rows = useLiveQuery(async () => {
    if (!listingId) return [];
    const all = await db.workPackages
      .where("listingId")
      .equals(listingId)
      .toArray();
    return all.filter((z) => !z.deletedAt);
  }, [listingId, workPackagesUpdatedAt]);

  const sorted = useMemo(() => {
    if (!rows?.length) return EMPTY;
    return [...rows].sort((a, b) =>
      String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
    );
  }, [rows]);

  return { value: sorted, loading: rows === undefined };
}
