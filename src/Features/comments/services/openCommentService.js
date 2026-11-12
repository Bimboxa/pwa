import { setOpenedCommentId } from "../commentsSlice";

import restoreCommentViewContextService from "./restoreCommentViewContextService";

// Opens a comment the way a reader does (pill of the strip, pin in the
// scene, row of the panel, previous / next): its content shows in the
// floating panel and the view goes back to the context saved with it.
// A failed restore (e.g. a write refused by a read-only scope while
// re-activating a base map version) never prevents reading the comment.
export default async function openCommentService({ comment, dispatch }) {
  if (!comment) return;
  dispatch(setOpenedCommentId(comment.id));
  try {
    await restoreCommentViewContextService({ comment, dispatch });
  } catch (error) {
    console.error("[comments] view context restore failed", error);
  }
}
