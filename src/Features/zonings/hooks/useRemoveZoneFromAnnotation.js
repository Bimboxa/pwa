import { useDispatch } from "react-redux";

import { triggerRelsZoneAnnotationUpdate } from "../zoningsSlice";

import db from "App/db/db";

export default function useRemoveZoneFromAnnotation() {
  const dispatch = useDispatch();

  return async (relId) => {
    // soft-delete middleware sets deletedAt
    await db.relsZoneAnnotation.delete(relId);
    dispatch(triggerRelsZoneAnnotationUpdate());
  };
}
