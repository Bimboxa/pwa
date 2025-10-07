import { useDispatch, useSelector } from "react-redux";

import { useState } from "react";

import {
  setNewEntity,
  setIsEditingEntity,
  setEditedEntity,
} from "../entitiesSlice";

import useEntity from "./useEntity";
import useUpdateEntity from "./useUpdateEntity";
import useCreateEntity from "./useCreateEntity";
import useCreateMarker from "Features/markers/hooks/useCreateMarker";

export default function useSaveEntity() {
  const dispatch = useDispatch();

  // data

  const tempMarker = useSelector((s) => s.markers.tempMarker);

  const create = useCreateEntity();
  const update = useUpdateEntity();
  const createMarker = useCreateMarker();

  // state

  const [loading, setLoading] = useState(false);

  // main

  const saveEntity = async (entity, options) => {
    if (loading) return;
    setLoading(true);
    //
    let result;
    if (!entity.id) {
      const newEntity = await create(entity, options);
      result = newEntity;
      if (tempMarker) {
        const { id: entityId, listingId: listingId } = newEntity;
        await createMarker({ ...tempMarker, entityId, listingId });
        dispatch(setTempMarkerProps(null));
      }
      dispatch(setNewEntity(null));
    } else {
      console.log("update entity", entity);
      result = await update(entity.id, entity, options);
      dispatch(setIsEditingEntity(false));
      dispatch(setEditedEntity({}));
    }
    //
    setLoading(false);
    //
    return result;
  };

  // return

  return [saveEntity, loading];
}
