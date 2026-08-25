import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Live photos of the whole project (every album), upload order (createdAt).
export default function useProjectPhotos({ projectId } = {}) {
  const photos = useLiveQuery(async () => {
    if (!projectId) return [];
    const rows = await db.photos.where("projectId").equals(projectId).toArray();
    return rows
      .filter((p) => !p.deletedAt)
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  }, [projectId]);

  return photos ?? [];
}
