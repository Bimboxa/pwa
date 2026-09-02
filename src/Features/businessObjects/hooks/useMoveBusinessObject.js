import { useDispatch } from "react-redux";

import { triggerBusinessObjectsUpdate } from "../businessObjectsSlice";

import db from "App/db/db";

export default function useMoveBusinessObject() {
  const dispatch = useDispatch();

  // Reorder / reparent a business object in its listing tree (fractional
  // sortIndex).
  const move = async (businessObjectId, { parentId, sortIndex }) => {
    await db.businessObjects.update(businessObjectId, {
      parentId: parentId ?? null,
      sortIndex,
    });
    dispatch(triggerBusinessObjectsUpdate());
  };

  return move;
}
