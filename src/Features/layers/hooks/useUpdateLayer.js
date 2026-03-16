import { useDispatch } from "react-redux";

import db from "App/db/db";
import { triggerLayersUpdate } from "../layersSlice";

export default function useUpdateLayer() {
  const dispatch = useDispatch();

  const updateLayer = async (id, changes) => {
    await db.layers.update(id, changes);
    dispatch(triggerLayersUpdate());
  };

  return updateLayer;
}
