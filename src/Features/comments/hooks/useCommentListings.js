import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { isCommentListing } from "../constants/commentEntityModel";

// Live COMMENT listings of the selected scope (rank order), plus the one
// displayed: the selected listing when it belongs to the scope, else the
// first one.
export default function useCommentListings() {
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const selectedListingId = useSelector((s) => s.comments.selectedListingId);

  const listings = useLiveQuery(async () => {
    if (!scopeId) return [];
    const rows = await db.listings.where("scopeId").equals(scopeId).toArray();
    return rows
      .filter((l) => !l.deletedAt && isCommentListing(l))
      .sort((a, b) => String(a.rank ?? "").localeCompare(String(b.rank ?? "")));
  }, [scopeId]);

  const commentListings = listings ?? [];
  const selectedListing =
    commentListings.find((l) => l.id === selectedListingId) ??
    commentListings[0] ??
    null;

  return { commentListings, selectedListing, loading: listings === undefined };
}
