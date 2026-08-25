import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Live photo row by id (null when missing or soft-deleted).
export default function usePhotoById(photoId) {
  const photo = useLiveQuery(async () => {
    if (!photoId) return null;
    const row = await db.photos.get(photoId);
    return row && !row.deletedAt ? row : null;
  }, [photoId]);

  return photo ?? null;
}
