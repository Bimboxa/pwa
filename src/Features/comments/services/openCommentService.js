import { setOpenedCommentId } from "../commentsSlice";

import db from "App/db/db";

import bindSeededCommentsService from "./bindSeededCommentsService";
import restoreCommentViewContextService from "./restoreCommentViewContextService";

// An info seeded by a configuration whose keys are not all resolved yet
// (seedRefs.pending): bound again before its view is restored, so a page
// created since (by a procedure…) is targeted. Returns the fresh row.
async function bindPendingComment(comment) {
  if (!comment.seedRefs?.pending) return comment;
  try {
    const count = await bindSeededCommentsService({
      projectId: comment.projectId,
      scopeId: comment.scopeId,
    });
    return count ? ((await db.comments.get(comment.id)) ?? comment) : comment;
  } catch (error) {
    // e.g. a write refused by a read-only scope
    console.error("[comments] seeded comment not bound", error);
    return comment;
  }
}

// Opens a comment the way a reader does (pill of the strip, pin in the
// scene, row of the panel, previous / next): its content shows in the
// floating panel and the view goes back to the context saved with it.
// A failed restore (e.g. a write refused by a read-only scope while
// re-activating a base map version) never prevents reading the comment.
export default async function openCommentService({ comment, dispatch }) {
  if (!comment) return;
  dispatch(setOpenedCommentId(comment.id));
  try {
    const boundComment = await bindPendingComment(comment);
    await restoreCommentViewContextService({
      comment: boundComment,
      dispatch,
    });
  } catch (error) {
    console.error("[comments] view context restore failed", error);
  }
}
