import db from "App/db/db";

import {
  openCommentForEditing,
  setIsLocatingComment,
  setOpenDialogCreateCommentListing,
  setSelectedCommentListingId,
} from "../commentsSlice";
import { isCommentListing } from "../constants/commentEntityModel";

import createCommentService from "./createCommentService";

// COMMENT listing a new comment goes to: the one displayed by the panel,
// else the first of the scope. Null when the scope has none yet.
async function resolveTargetListing(state) {
  const scopeId = state.scopes.selectedScopeId;
  if (!scopeId) return null;
  const listings = (
    await db.listings.where("scopeId").equals(scopeId).toArray()
  )
    .filter((l) => !l.deletedAt && isCommentListing(l))
    .sort((a, b) => String(a.rank ?? "").localeCompare(String(b.rank ?? "")));
  return (
    listings.find((l) => l.id === state.comments.selectedListingId) ??
    listings[0] ??
    null
  );
}

// "+ Commentaire" / "+ Commentaire localisé" (commands of the Comments
// module). Without any comment listing the creation dialog of a listing opens
// first: a comment always belongs to a listing.
// Not located: the comment is created right away with the displayed view.
// Located: arms the location pick — the next click in the editor creates it
// (commitLocatedCommentService).
export default async function startAddCommentService({
  located = false,
  dispatch,
  store,
}) {
  const listing = await resolveTargetListing(store.getState());
  if (!listing) {
    dispatch(setOpenDialogCreateCommentListing(true));
    return null;
  }
  if (located) {
    dispatch(setIsLocatingComment(true));
    return null;
  }
  const comment = await createCommentService({ listingId: listing.id });
  if (comment) {
    dispatch(setSelectedCommentListingId(listing.id));
    dispatch(openCommentForEditing(comment.id));
  }
  return comment;
}

// Second half of "+ Commentaire localisé": the location was picked.
export async function commitLocatedCommentService({
  location,
  dispatch,
  store,
}) {
  dispatch(setIsLocatingComment(false));
  if (!location) return null;
  const listing = await resolveTargetListing(store.getState());
  if (!listing) return null;
  const comment = await createCommentService({
    listingId: listing.id,
    location,
  });
  if (comment) {
    dispatch(setSelectedCommentListingId(listing.id));
    dispatch(openCommentForEditing(comment.id));
  }
  return comment;
}
