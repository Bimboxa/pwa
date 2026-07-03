import { useDispatch, useSelector } from "react-redux";

import db from "App/db/db";
import { triggerLayersUpdate, setActiveLayerId } from "../layersSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";

export default function useDeleteLayer() {
  const dispatch = useDispatch();
  const activeLayerId = useSelector((s) => s.layers.activeLayerId);
  const deleteAnnotations = useDeleteAnnotations();

  const deleteLayer = async ({ layerId, mode, targetLayerId }) => {
    // fetch annotations belonging to this layer (indexed query on baseMapId)
    const layer = await db.layers.get(layerId);
    const layerAnnotations = layer?.baseMapId
      ? (
          await db.annotations
            .where("baseMapId")
            .equals(layer.baseMapId)
            .toArray()
        ).filter((a) => !a.deletedAt && a.layerId === layerId)
      : [];

    if (mode === "DELETE_ANNOTATIONS") {
      const ids = layerAnnotations.map((a) => a.id);
      if (ids.length > 0) {
        // bulk cascade: rels, cuts, listings, orphan points + single
        // triggerAnnotationsUpdate dispatched by the hook itself
        await deleteAnnotations(ids);
      }
    } else if (mode === "MOVE_TO_LAYER") {
      const updates = layerAnnotations.map((a) => ({
        key: a.id,
        changes: { layerId: targetLayerId ?? null },
      }));
      if (updates.length > 0) {
        await db.annotations.bulkUpdate(updates);
        dispatch(triggerAnnotationsUpdate());
      }
    }

    // soft-delete the layer
    await db.layers.delete(layerId);

    // clear active layer if needed
    if (activeLayerId === layerId) {
      dispatch(setActiveLayerId(null));
    }

    dispatch(triggerLayersUpdate());
  };

  return deleteLayer;
}
