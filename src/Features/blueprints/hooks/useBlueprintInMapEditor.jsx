import { useSelector } from "react-redux";

import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useBlueprintInMapEditor() {
  // data

  const id = useSelector((s) => s.blueprints.blueprintIdInMapEditor);

  // return

  return useLiveQuery(async () => {
    let bp;
    if (id) bp = await db.blueprints.get(id);
    return bp;
  }, [id]);
}
