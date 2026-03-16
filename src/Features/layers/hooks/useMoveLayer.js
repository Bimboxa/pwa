import { useDispatch } from "react-redux";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import { triggerLayersUpdate } from "../layersSlice";

export default function useMoveLayer() {
  const dispatch = useDispatch();

  const moveLayer = async (layerId, sortedLayers, newIndex) => {
    const prev = newIndex > 0 ? sortedLayers[newIndex - 1]?.orderIndex : null;
    const next =
      newIndex < sortedLayers.length - 1
        ? sortedLayers[newIndex + 1]?.orderIndex
        : null;

    // handle case where the moved layer is already at newIndex
    const current = sortedLayers[newIndex];
    if (current?.id === layerId) return;

    const orderIndex = generateKeyBetween(prev ?? null, next ?? null);
    await db.layers.update(layerId, { orderIndex });
    dispatch(triggerLayersUpdate());
  };

  return moveLayer;
}
