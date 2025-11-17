import { useDispatch } from "react-redux";

import { triggerRelsUpdate } from "../relsZoneEntitySlice";

import db from "App/db/db";

export default function useRemoveZoneFromEntity() {
  const dispatch = useDispatch();

  const removeZoneFromEntity = async ({ zoneId, entityId }) => {
    if (!zoneId || !entityId) return;

    // Find the relation(s) matching zoneId and entityId
    const allRelations = await db.relsZoneEntity
      .where("zoneId")
      .equals(zoneId)
      .toArray();

    const relations = allRelations.filter((rel) => rel.entityId === entityId);

    // Delete all matching relations
    if (relations.length > 0) {
      await Promise.all(
        relations.map((rel) => db.relsZoneEntity.delete(rel.id))
      );
    }

    dispatch(triggerRelsUpdate());

    return relations;
  };

  return removeZoneFromEntity;
}
