import { useDispatch } from "react-redux";

import { triggerZonesUpdate } from "../zoningsSlice";

import db from "App/db/db";

export default function useMoveZone() {
  const dispatch = useDispatch();

  // Reorder / reparent a zone in its listing tree (fractional sortIndex).
  const move = async (zoneId, { parentId, sortIndex }) => {
    await db.zones.update(zoneId, { parentId: parentId ?? null, sortIndex });
    dispatch(triggerZonesUpdate());
  };

  return move;
}
