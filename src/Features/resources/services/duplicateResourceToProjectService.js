import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

// Returns a live resource of `projectId` holding the same content as
// `resource` (same sourceKey, file present): the resource itself when it
// already belongs to the project, an existing same-project twin, or a copy
// (new row + copied db.files bytes). The source PDF of a base map must live
// in the base map's project — the RESOURCES panel lists a project's rows.
// Returns null when the source file is missing.
export default async function duplicateResourceToProject(
  resource,
  { projectId, createdBy = null } = {}
) {
  if (!resource?.fileName || !projectId) return null;
  if (resource.projectId === projectId) return resource;

  if (resource.sourceKey) {
    const twins = (
      await db.resources.where("sourceKey").equals(resource.sourceKey).toArray()
    ).filter((r) => !r.deletedAt && r.fileName && r.projectId === projectId);
    for (const twin of twins) {
      const f = await db.files.get(twin.fileName);
      if (f?.fileArrayBuffer) return twin;
    }
  }

  const fileRecord = await db.files.get(resource.fileName);
  if (!fileRecord?.fileArrayBuffer) return null;

  const id = nanoid();
  const name = resource.name;
  const fileName = `resource_${id}_${name}`;
  const copy = {
    ...resource,
    id,
    projectId,
    fileName,
    visibility: "PROJECT",
    scopeId: null,
    createdBy: createdBy ?? resource.createdBy ?? null,
  };
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.createdByUserIdMaster;
  delete copy.updatedByUserIdMaster;
  delete copy.deletedAt;
  delete copy.deletedByUserIdMaster;

  await db.transaction("rw", db.resources, db.files, async () => {
    await db.files.put({
      fileName,
      fileMime: fileRecord.fileMime,
      srcFileName: fileRecord.srcFileName ?? name,
      fileArrayBuffer: fileRecord.fileArrayBuffer.slice(0),
      projectId,
      fileType: fileRecord.fileType,
    });
    await db.resources.add(copy);
  });
  return copy;
}
