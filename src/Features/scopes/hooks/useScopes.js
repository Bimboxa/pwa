import {useState, useEffect} from "react";
import {useLiveQuery} from "dexie-react-hooks";

import db from "App/db/db";
import demoScope from "../data/demoScope";

export default function useScopes(options) {
  const [loading, setLoading] = useState(true);
  const [scopes, setScopes] = useState([]);

  // options

  const filterByProjectId = options?.filterByProjectId;

  // helpers

  const isDemoProject = filterByProjectId === "demo";

  // data

  const fetchedScopes = useLiveQuery(async () => {
    let scopes;
    if (filterByProjectId) {
      scopes = await db.scopes
        .where("projectId")
        .equals(filterByProjectId)
        .toArray();
    } else {
      scopes = await db.scopes.toArray();
    }
    setLoading(false);
    return scopes;
  });

  // demoScope

  useEffect(() => {
    if (fetchedScopes && isDemoProject) {
      setScopes([...fetchedScopes, demoScope]);
    }
  }, [fetchedScopes]);

  // return

  return {value: scopes, loading};
}
