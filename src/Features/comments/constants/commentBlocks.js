import { nanoid } from "@reduxjs/toolkit";

// Blocks of a comment body, in reading order. More types will follow (PDF
// resource refs, points of view…): a renderer / editor must ignore the types
// it does not know.
export const COMMENT_BLOCK_TYPES = {
  TEXT: "TEXT", // { markdown }
  IMAGE: "IMAGE", // { fileName, imageSize, caption }
  LINK: "LINK", // { url, label }
  YOUTUBE: "YOUTUBE", // { url, videoId }
};

export function createCommentBlock(type, props = {}) {
  const base = { id: nanoid(), type };
  if (type === COMMENT_BLOCK_TYPES.TEXT)
    return { ...base, markdown: "", ...props };
  if (type === COMMENT_BLOCK_TYPES.IMAGE)
    return { ...base, fileName: null, imageSize: null, caption: "", ...props };
  if (type === COMMENT_BLOCK_TYPES.LINK)
    return { ...base, url: "", label: "", ...props };
  if (type === COMMENT_BLOCK_TYPES.YOUTUBE)
    return { ...base, url: "", videoId: null, ...props };
  return { ...base, ...props };
}

// File names of the image blocks (db.files keys).
export function getCommentBlocksFileNames(blocks) {
  return (blocks ?? [])
    .filter((b) => b?.type === COMMENT_BLOCK_TYPES.IMAGE && b.fileName)
    .map((b) => b.fileName);
}
