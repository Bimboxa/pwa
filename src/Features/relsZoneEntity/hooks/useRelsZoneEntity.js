import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

export default function useRelsZoneEntity({ entityId }) {
  // data

  const updatedAt = useSelector(
    (s) => s.relsZoneEntity.relsZoneEntityUpdatedAt
  );

  // return

  return useLiveQuery(async () => {
    if (entityId) {
      const rels = await db.relsZoneEntity
        .where("entityId")
        .equals(entityId)
        .toArray();

      return rels;
    }
  }, [entityId, updatedAt]);
}
