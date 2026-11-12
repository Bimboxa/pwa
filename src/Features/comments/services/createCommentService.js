import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import snapshotCommentViewContextService from "./snapshotCommentViewContextService";

// Creates a comment at the end of a COMMENT listing, with the view context of
// the displayed editor. `location` (null = not located) is
// { baseMapId, point: {x, y} | null, worldPosition: {x, y, z} | null } — see
// pickCommentLocationService.
export default async function createCommentService({
  listingId,
  location = null,
} = {}) {
  const listing = listingId ? await db.listings.get(listingId) : null;
  if (!listing || listing.deletedAt) return null;

  const comments = (
    await db.comments.where("listingId").equals(listingId).toArray()
  ).filter((c) => !c.deletedAt);
  const lastSortIndex = comments
    .map((c) => c.sortIndex)
    .filter((s) => s != null)
    .sort()
    .pop();

  const viewContext = await snapshotCommentViewContextService();

  const comment = {
    id: nanoid(),
    projectId: listing.projectId,
    scopeId: listing.scopeId ?? null,
    listingId,
    title: "",
    sortIndex: generateKeyBetween(lastSortIndex ?? null, null),
    blocks: [],
    location,
    viewContext,
  };

  await db.comments.add(comment);
  return comment;
}
