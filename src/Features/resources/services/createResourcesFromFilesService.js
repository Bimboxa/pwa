import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import getResourceFileType from "../utils/getResourceFileType";
import generateResourceThumbnail from "../utils/generateResourceThumbnail";
import detectIsPdfDocumentService from "./detectIsPdfDocumentService";
import {
  describeTooLarge,
  isResourceFileTooLarge,
} from "../constants/resourceLimits";

// Creates one resource per file. The main file is written to db.files WITHOUT
// listingId: the Krto files filter requires a relevant listingId, so resource
// main files never ship in the scope export (only the metadata row does,
// thumbnail included).
//
// Hook-free so non-React code (relay runtime) can create a resource from a
// downloaded PDF. `props` are extra fields spread on every resource row
// (isPromptIaAttachment, relayPdfId…).
export default async function createResourcesFromFilesService({
  files,
  projectId,
  scopeId = null,
  visibility = "SCOPE",
  createdBy = null,
  props = null,
}) {
  const validFiles = (files ?? []).filter(Boolean);
  if (!projectId || validFiles.length === 0) return [];

  const tooLarge = validFiles.find(isResourceFileTooLarge);
  if (tooLarge) {
    const error = new Error(describeTooLarge(tooLarge));
    error.code = "FILE_TOO_LARGE";
    throw error;
  }

  const resourceRecords = [];
  const fileRecords = [];

  for (const file of validFiles) {
    const id = nanoid();
    const fileName = `resource_${id}_${file.name}`;
    const thumbnail = await generateResourceThumbnail(file);
    const fileType = getResourceFileType(file);
    // Text document (CCTP…) vs plan: drives the viewer (selectable text +
    // highlights linked to business objects).
    const isDocument =
      fileType === "PDF" ? await detectIsPdfDocumentService({ file }) : false;

    resourceRecords.push({
      isDocument,
      ...(props ?? {}),
      id,
      projectId,
      name: file.name,
      fileName,
      fileSize: file.size,
      fileMime: file.type,
      fileType: getResourceFileType(file),
      thumbnail,
      createdBy,
      visibility,
      scopeId: visibility === "SCOPE" ? scopeId : null,
    });

    fileRecords.push({
      fileName,
      fileMime: file.type,
      srcFileName: file.name,
      fileArrayBuffer: await file.arrayBuffer(),
      projectId,
      fileType: getResourceFileType(file),
    });
  }

  await db.transaction("rw", db.resources, db.files, async () => {
    await db.files.bulkAdd(fileRecords);
    await db.resources.bulkAdd(resourceRecords);
  });

  return resourceRecords;
}
