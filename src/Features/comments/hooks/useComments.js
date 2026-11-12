import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export function sortComments(comments) {
  return [...comments].sort((a, b) => {
    const sa = a.sortIndex ?? "";
    const sb = b.sortIndex ?? "";
    if (sa !== sb) return sa < sb ? -1 : 1;
    const ca = a.createdAt ?? "";
    const cb = b.createdAt ?? "";
    if (ca !== cb) return ca < cb ? -1 : 1;
    return 0;
  });
}

// The number of a comment is not stored: it is its 1-based rank in the
// reading order of its listing.
export function numberComments(sortedComments) {
  return sortedComments.map((comment, index) => ({
    ...comment,
    num: index + 1,
  }));
}

// Live comments of a COMMENT listing, in reading order (sortIndex), each with
// its computed `num`.
export default function useComments({ listingId } = {}) {
  const comments = useLiveQuery(async () => {
    if (!listingId) return [];
    const rows = await db.comments
      .where("listingId")
      .equals(listingId)
      .toArray();
    return numberComments(sortComments(rows.filter((c) => !c.deletedAt)));
  }, [listingId]);

  return comments ?? [];
}
