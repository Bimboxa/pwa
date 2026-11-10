import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

// Creates an empty block. Its origin (insertion point) is set when the first
// member is linked (setAnnotationsBlockService).
export default async function createBlockService({ projectId, scopeId, label }) {
  if (!projectId || !scopeId)
    throw new Error("projectId and scopeId are required");
  const block = {
    id: nanoid(),
    projectId,
    scopeId,
    label: label?.trim() || "Bloc",
    origin: null,
  };
  await db.blocks.add(block);
  return block;
}
