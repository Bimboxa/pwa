import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

export default function useBaseMapViews() {
  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // helpers

  const query = useLiveQuery(async () => {
    const views = await db.baseMapViews
      .where("scopeId")
      .equals(scopeId)
      .toArray();

    return views;
  }, [scopeId]);

  return query;
}
