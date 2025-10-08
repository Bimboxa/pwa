import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

export default async function loadKrtoFile(blob) {
  // Unique tag to find the imported rows
  const importTag = nanoid();

  await db.import(blob, {
    overwriteValues: true,
    acceptVersionDiff: true,
    acceptMissingTables: true,
    chunkSizeBytes: 8 * 1024 * 1024, // 8–16MB works well on iOS
    // Tag just the 'projects' row so we can find it after import
    transform: (table, value) => {
      if (table === "projects" && value) {
        return { value: { ...value, __importTag: importTag } };
      }
      return { value };
    },
  });

  // Retrieve the (only) project that came from the blob
  const project = await db
    .table("projects")
    .where("__importTag")
    .equals(importTag)
    .first();

  if (!project) {
    throw new Error("Imported project not found (unexpected).");
  }

  // Optional: clean the temporary tag
  await db
    .table("projects")
    .where("__importTag")
    .equals(importTag)
    .modify((p) => {
      delete p.__importTag;
    });

  return project;
}
