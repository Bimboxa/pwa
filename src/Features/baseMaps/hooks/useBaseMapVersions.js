import db from "App/db/db";
import { useLiveQuery } from "dexie-react-hooks";

export default function useBaseMapVersions(options) {
  const baseMapId = options?.baseMapId;

  return useLiveQuery(async () => {
    if (!baseMapId) return [];
    const records = await db.baseMapVersions
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    return records
      .filter((r) => !r.deletedAt)
      .sort((a, b) =>
        (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
      );
  }, [baseMapId]);
}
