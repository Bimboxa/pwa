import { useDispatch } from "react-redux";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import { triggerLayersUpdate } from "../layersSlice";

// Mode-agnostic: the id is looked up in db.layers first, then in
// db.globalLayers.
export default function useMoveLayer() {
  const dispatch = useDispatch();

  const moveLayer = async (layerId, prevOrderIndex, nextOrderIndex) => {
    const orderIndex = generateKeyBetween(
      prevOrderIndex ?? null,
      nextOrderIndex ?? null
    );
    const updated = await db.layers.update(layerId, { orderIndex });
    if (!updated) await db.globalLayers.update(layerId, { orderIndex });
    dispatch(triggerLayersUpdate());
  };

  return moveLayer;
}
