import { useDispatch } from "react-redux";

import db from "App/db/db";
import { triggerLayersUpdate } from "../layersSlice";

// Mode-agnostic: the id is looked up in db.layers first, then in
// db.globalLayers.
export default function useUpdateLayer() {
  const dispatch = useDispatch();

  const updateLayer = async (id, changes) => {
    const updated = await db.layers.update(id, changes);
    if (!updated) await db.globalLayers.update(id, changes);
    dispatch(triggerLayersUpdate());
  };

  return updateLayer;
}
