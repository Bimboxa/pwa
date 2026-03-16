import { useDispatch, useSelector } from "react-redux";

import db from "App/db/db";
import { triggerLayersUpdate, setActiveLayerId } from "../layersSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

export default function useDeleteLayer() {
  const dispatch = useDispatch();
  const activeLayerId = useSelector((s) => s.layers.activeLayerId);

  const deleteLayer = async ({ layerId, mode, targetLayerId }) => {
    // fetch annotations belonging to this layer
    const allAnnotations = await db.annotations.toArray();
    const layerAnnotations = allAnnotations.filter(
      (a) => !a.deletedAt && a.layerId === layerId
    );

    if (mode === "DELETE_ANNOTATIONS") {
      const ids = layerAnnotations.map((a) => a.id);
      if (ids.length > 0) {
        await db.annotations.bulkDelete(ids);
      }
    } else if (mode === "MOVE_TO_LAYER") {
      const updates = layerAnnotations.map((a) => ({
        key: a.id,
        changes: { layerId: targetLayerId ?? null },
      }));
      if (updates.length > 0) {
        await Promise.all(
          updates.map((u) => db.annotations.update(u.key, u.changes))
        );
      }
    }

    // soft-delete the layer
    await db.layers.delete(layerId);

    // clear active layer if needed
    if (activeLayerId === layerId) {
      dispatch(setActiveLayerId(null));
    }

    dispatch(triggerLayersUpdate());
    dispatch(triggerAnnotationsUpdate());
  };

  return deleteLayer;
}
