import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import { setActiveLayerId, triggerLayersUpdate } from "../layersSlice";

export default function useCreateLayer() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const createLayer = async ({ baseMapId, name }) => {
    // compute orderIndex after the last existing layer
    const existing = await db.layers
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    const sorted = existing
      .filter((r) => !r.deletedAt && r.orderIndex != null)
      .map((r) => r.orderIndex)
      .sort();
    const lastIndex = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const orderIndex = generateKeyBetween(lastIndex, null);

    const layer = {
      id: nanoid(),
      baseMapId,
      projectId,
      name,
      orderIndex,
    };

    await db.layers.add(layer);
    dispatch(triggerLayersUpdate());
    dispatch(setActiveLayerId(layer.id));

    return layer;
  };

  return createLayer;
}
