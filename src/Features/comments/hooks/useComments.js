import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export function sortComments(comments) {
  return [...comments].sort((a, b) => {
    const sa = a.sortIndex ?? "";
    const sb = b.sortIndex ?? "";
    if (sa !== sb) return sa < sb ? -1 : 1;
    return (a.num ?? 0) - (b.num ?? 0);
  });
}

// Live comments of a COMMENT listing, in reading order (sortIndex).
export default function useComments({ listingId } = {}) {
  const comments = useLiveQuery(async () => {
    if (!listingId) return [];
    const rows = await db.comments
      .where("listingId")
      .equals(listingId)
      .toArray();
    return sortComments(rows.filter((c) => !c.deletedAt));
  }, [listingId]);

  return comments ?? [];
}
