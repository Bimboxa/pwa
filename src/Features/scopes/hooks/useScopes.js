import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useScopes(options) {
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  // options

  const filterByProjectId = options?.filterByProjectId;
  const sortByClientRef = options?.sortByClientRef;
  const withProject = options?.withProject;

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
    // withProject
    if (withProject) {
      const projects = await db.projects.toArray();
      const projectById = getItemsByKey(projects, "id");
      scopes = scopes.map((s) => ({ ...s, project: projectById[s.projectId] }));
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
    setUpdatedAt(Date.now());
    return scopes;
  }, [filterByProjectId]);

  // return

  return { value: fetchedScopes, loading, updatedAt };
}
