import db from "App/db/db";

import { getCommentBlocksFileNames } from "../constants/commentBlocks";

// Saves the edited title / blocks of a comment and drops the image files of
// the blocks that were removed (a file belongs to one block only).
export default async function updateCommentService({
  commentId,
  title,
  blocks,
}) {
  const comment = commentId ? await db.comments.get(commentId) : null;
  if (!comment) return null;

  const nextBlocks = blocks ?? [];
  const kept = new Set(getCommentBlocksFileNames(nextBlocks));
  const removed = getCommentBlocksFileNames(comment.blocks).filter(
    (fileName) => !kept.has(fileName)
  );

  await db.transaction("rw", db.comments, db.files, async () => {
    await db.comments.update(commentId, {
      title: (title ?? "").trim(),
      blocks: nextBlocks,
    });
    if (removed.length) await db.files.bulkDelete(removed);
  });

  return { ...comment, title: (title ?? "").trim(), blocks: nextBlocks };
}

// Image files added to a draft that was cancelled: never referenced by the
// saved comment, so they go.
export async function discardDraftImageFilesService({ comment, draftBlocks }) {
  const saved = new Set(getCommentBlocksFileNames(comment?.blocks));
  const orphans = getCommentBlocksFileNames(draftBlocks).filter(
    (fileName) => !saved.has(fileName)
  );
  if (orphans.length) await db.files.bulkDelete(orphans);
}
