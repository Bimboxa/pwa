import { useLiveQuery } from "dexie-react-hooks";
import exampleMasterScopes from "../data/exampleMasterScopes";

import db from "App/db/db";

export default function useMasterScopes(options) {
  // options

  const filterByProjectId = options?.filterByProjectId;

  // main

  const master = filterByProjectId
    ? exampleMasterScopes.filter((s) => s.projectId === filterByProjectId)
    : exampleMasterScopes;

  const local = useLiveQuery(async () => {
    let _scopes;
    if (filterByProjectId) {
      _scopes = await db.scopes
        .where("projectId")
        .equals(filterByProjectId)
        .toArray();
    } else {
      _scopes = await db.scopes.toArray();
    }

    return _scopes;
  });

  // return

  return [...local, ...master];
}
