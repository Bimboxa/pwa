import db from "App/db/db";

import { useDispatch } from "react-redux";

import { setSelectedEntityId } from "../entitiesSlice";
import { triggerEntitiesUpdate } from "../entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

export default function useDeleteEntity() {
  const dispatch = useDispatch();

  const deleteEntity = async (entity) => {
    const listing = await db.listings.get(entity.listingId);

    const table = listing.table;

    await db[table].delete(entity.id);
    await db.annotations.where("entityId").equals(entity.id).delete();

    dispatch(setSelectedEntityId(null));
    dispatch(triggerEntitiesUpdate());
    dispatch(triggerAnnotationsUpdate());
  };

  return deleteEntity;
}
