import { nanoid } from "@reduxjs/toolkit";

// Blocks of a comment body, in reading order. More types will follow (PDF
// resource refs, points of view…): a renderer / editor must ignore the types
// it does not know.
export const COMMENT_BLOCK_TYPES = {
  TEXT: "TEXT", // { markdown }
  IMAGE: "IMAGE", // { fileName, imageSize, caption }
  LINK: "LINK", // { url, label }
  YOUTUBE: "YOUTUBE", // { url, videoId }
  // Button starting the drawing of an annotation template with a given tool,
  // like a click on the template row of PopperMapListings
  // (runCommentDrawActionService). `toolKey` null = the template's own tool.
  DRAW_ACTION: "DRAW_ACTION", // { annotationTemplateId, listingId, toolKey, label }
  // "Dessin auto" band of a listing locked on one of its procedures, like
  // the one of PopperMapListings (SectionListingProcedures).
  PROCEDURE_ACTION: "PROCEDURE_ACTION", // { listingId, procedureKey }
  // List of annotation templates, shown like the template rows of
  // PopperMapListings; a click on a row toggles the solo of that template.
  // The stored order is not meaningful: the rows follow the panel order.
  TEMPLATES_LIST: "TEMPLATES_LIST", // { annotationTemplateIds }
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
  if (type === COMMENT_BLOCK_TYPES.DRAW_ACTION)
    return {
      ...base,
      annotationTemplateId: null,
      listingId: null,
      toolKey: null,
      label: "",
      ...props,
    };
  if (type === COMMENT_BLOCK_TYPES.PROCEDURE_ACTION)
    return { ...base, listingId: null, procedureKey: null, ...props };
  if (type === COMMENT_BLOCK_TYPES.TEMPLATES_LIST)
    return { ...base, annotationTemplateIds: [], ...props };
  return { ...base, ...props };
}

// File names of the image blocks (db.files keys).
export function getCommentBlocksFileNames(blocks) {
  return (blocks ?? [])
    .filter((b) => b?.type === COMMENT_BLOCK_TYPES.IMAGE && b.fileName)
    .map((b) => b.fileName);
}
