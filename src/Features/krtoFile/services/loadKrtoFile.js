import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

export default async function loadKrtoFile(blob, options) {
  // Validate blob
  if (!blob || !(blob instanceof Blob)) {
    throw new Error("Invalid blob provided for import");
  }

  console.log("Loading KRTO file, size:", blob.size, "type:", blob.type);

  // Unique tag to find the imported rows
  const importTag = nanoid();

  // options

  const loadAnnotationTemplatesToListingId =
    options?.loadAnnotationTemplatesToListingId;

  const loadDataToProjectId = options?.loadDataToProjectId;

  try {
    await db.import(blob, {
      overwriteValues: true,
      acceptVersionDiff: true,
      acceptMissingTables: true,
      chunkSizeBytes: 15 * 1024 * 1024, // Reduced to 1MB chunks for better compatibility
      noTransaction: false, // Ensure transactions are used
      // Tag just the 'projects' row so we can find it after import
      transform: (table, value) => {
        if (loadAnnotationTemplatesToListingId && loadDataToProjectId) {
          return {
            value: {
              ...value,
              listingId: loadAnnotationTemplatesToListingId,
              projectId: loadDataToProjectId,
            },
          };
        } else {
          if (table === "projects" && value) {
            return { value: { ...value, __importTag: importTag } };
          }
          return { value };
        }
      },
      progressCallback: (progress) => {
        console.log(
          `Import progress: ${Math.round(
            progress.completedRows
          )} / ${Math.round(progress.totalRows)} rows (${Math.round(
            (progress.completedRows / progress.totalRows) * 100
          )}%)`
        );
        return true; // Continue import
      },
    });
  } catch (error) {
    console.error("Failed to import KRTO file:", error);
    throw new Error(`Import failed: ${error.message}`);
  }

  // Retrieve the (only) project that came from the blob
  const project = await db
    .table("projects")
    .where("__importTag")
    .equals(importTag)
    .first();

  // if (!project) {
  //   throw new Error("Imported project not found (unexpected).");
  // }

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
