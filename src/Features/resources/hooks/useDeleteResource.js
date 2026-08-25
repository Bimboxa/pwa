import db from "App/db/db";

// Soft-deletes the resource row (middleware tombstone, so the deletion ships
// in the Krto export) and hard-deletes its db.files row — unless another live
// resource still references the same fileName (a duplicated scope shares the
// main-file blob: the fileName is not remapped because the file row is absent
// from the zip).
export default function useDeleteResource() {
  return async function deleteResource(resource) {
    if (!resource?.id) return;

    await db.resources.delete(resource.id);

    const fileName = resource.fileName;
    if (!fileName) return;
    const stillReferenced = (await db.resources.toArray()).some(
      (r) => r.id !== resource.id && !r.deletedAt && r.fileName === fileName
    );
    if (!stillReferenced) await db.files.delete(fileName);
  };
}
