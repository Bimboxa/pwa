import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function usePhotoPlans({ baseMapId, projectId } = {}) {
  // trigger

  const photoPlansUpdatedAt = useSelector(
    (s) => s.photoPlans.photoPlansUpdatedAt
  );

  // main

  const photoPlans = useLiveQuery(async () => {
    let collection;
    if (baseMapId) {
      collection = db.photoPlans.where("baseMapId").equals(baseMapId);
    } else if (projectId) {
      collection = db.photoPlans.where("projectId").equals(projectId);
    } else {
      return [];
    }
    const rows = await collection.toArray();
    return rows.filter((p) => !p.deletedAt);
  }, [baseMapId, projectId, photoPlansUpdatedAt]);

  return { value: photoPlans, loading: photoPlans === undefined };
}
