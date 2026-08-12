import { useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";
import getResourceFileType from "../utils/getResourceFileType";
import generateResourceThumbnail from "../utils/generateResourceThumbnail";

// Creates one resource per dropped/selected file. The main file is written to
// db.files WITHOUT listingId: the Krto files filter requires a relevant
// listingId, so resource main files never ship in the scope export (only the
// metadata row does, thumbnail included).
export default function useCreateResourcesFromFiles() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const userProfile = useSelector((s) => s.auth.userProfile);

  return async function createResourcesFromFiles(files) {
    const validFiles = (files ?? []).filter(Boolean);
    if (!projectId || validFiles.length === 0) return [];

    // createdBy trigram follows the POV pattern
    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };

    const resourceRecords = [];
    const fileRecords = [];

    for (const file of validFiles) {
      const id = nanoid();
      const fileName = `resource_${id}_${file.name}`;
      const thumbnail = await generateResourceThumbnail(file);

      resourceRecords.push({
        id,
        projectId,
        name: file.name,
        fileName,
        fileSize: file.size,
        fileMime: file.type,
        fileType: getResourceFileType(file),
        thumbnail,
        createdBy,
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
  };
}
