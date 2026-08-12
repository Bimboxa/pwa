import db from "App/db/db";

import getResourceFileType from "../utils/getResourceFileType";

// Re-attaches a resource's main file locally (post-Krto-import: the metadata
// row is here but the file was deliberately left out of the zip). Rewrites
// the db.files row under the SAME fileName and refreshes the size/mime
// metadata from the picked file.
export default function useReattachResourceFile() {
  return async function reattachResourceFile(resource, file) {
    if (!resource?.fileName || !file) return;

    const fileArrayBuffer = await file.arrayBuffer();

    await db.transaction("rw", db.resources, db.files, async () => {
      await db.files.put({
        fileName: resource.fileName,
        fileMime: file.type,
        srcFileName: file.name,
        fileArrayBuffer,
        projectId: resource.projectId,
        fileType: getResourceFileType(file),
      });
      await db.resources.update(resource.id, {
        fileSize: file.size,
        fileMime: file.type,
      });
    });
  };
}
