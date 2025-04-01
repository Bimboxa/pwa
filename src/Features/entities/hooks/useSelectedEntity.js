import {useState} from "react";
import {useSelector} from "react-redux";

import {useLiveQuery} from "dexie-react-hooks";

import db from "App/db/db";

export default function useSelectedEntity() {
  // state

  const [loading, setLoading] = useState(true);

  // data

  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);

  const entity = useLiveQuery(async () => {
    if (!selectedEntityId) {
      setLoading(false);
      return null;
    }
    try {
      const entity = await db.entities.get(selectedEntityId);
      setLoading(false);
      return entity;
    } catch (e) {
      console.log("[db] error fetching entity", e);
      return null;
    }
  }, [selectedEntityId]);

  return {value: entity, loading};
}
