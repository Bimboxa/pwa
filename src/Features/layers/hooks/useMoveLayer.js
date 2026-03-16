import { useDispatch } from "react-redux";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import { triggerLayersUpdate } from "../layersSlice";

export default function useMoveLayer() {
  const dispatch = useDispatch();

  const moveLayer = async (layerId, prevOrderIndex, nextOrderIndex) => {
    const orderIndex = generateKeyBetween(
      prevOrderIndex ?? null,
      nextOrderIndex ?? null
    );
    await db.layers.update(layerId, { orderIndex });
    dispatch(triggerLayersUpdate());
  };

  return moveLayer;
}
