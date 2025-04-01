import {useState, useEffect} from "react";
import {useLiveQuery} from "dexie-react-hooks";

import db from "App/db/db";
import demoScope from "../data/demoScope";

export default function useScopes(options) {
  const [loading, setLoading] = useState(true);
  const [scopes, setScopes] = useState([]);

  // options

  const filterByProjectId = options?.filterByProjectId;
  const sortByClientRef = options?.sortByClientRef;

  // helpers

  const isDemoProject = filterByProjectId === "demo";

  // data

  const fetchedScopes = useLiveQuery(async () => {
    let scopes;
    setLoading(true);
    if (filterByProjectId) {
      scopes = await db.scopes
        .where("projectId")
        .equals(filterByProjectId)
        .toArray();
    } else {
      scopes = await db.scopes.toArray();
    }
    // sort
    if (sortByClientRef) {
      scopes = scopes.sort((a, b) => {
        const aClientRef = a.clientRef || "";
        const bClientRef = b.clientRef || "";
        return aClientRef.localeCompare(bClientRef);
      });
    }
    setLoading(false);
    return scopes;
  }, [filterByProjectId]);

  // demoScope

  useEffect(() => {
    if (fetchedScopes && isDemoProject) {
      setScopes([...fetchedScopes, demoScope]);
    } else if (fetchedScopes) {
      setScopes(fetchedScopes);
    }
  }, [fetchedScopes, isDemoProject]);

  // return

  return {value: scopes, loading};
}
