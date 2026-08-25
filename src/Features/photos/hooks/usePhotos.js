import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Live photos of one album (PHOTO listing), upload order (createdAt).
export default function usePhotos({ listingId } = {}) {
  const photos = useLiveQuery(async () => {
    if (!listingId) return [];
    const rows = await db.photos.where("listingId").equals(listingId).toArray();
    return rows
      .filter((p) => !p.deletedAt)
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  }, [listingId]);

  return photos ?? [];
}
