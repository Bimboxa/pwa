import db from "App/db/db";

// Soft-deletes the photo row (middleware) and deletes its image file —
// nothing else references the blob (db.files is not soft-deleted).
export default function useDeletePhoto() {
  return async function deletePhoto(photo) {
    if (!photo?.id) return;
    await db.photos.delete(photo.id); // soft delete (middleware)
    const fileName = photo.image?.fileName;
    if (fileName) await db.files.delete(fileName);
  };
}
