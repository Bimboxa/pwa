import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

export default function useBlueprints(options) {
  // options

  const filterByProjectId = options?.filterByProjectId;

  // data

  const _projectId = useSelector((s) => s.projects.selectedProjectId);

  // helpers

  const projectId = filterByProjectId ?? _projectId;

  // main

  const blueprints = useLiveQuery(async () => {
    let _blueprints = await db.blueprints
      .where("projectId")
      .equals(projectId)
      .toArray();
    return _blueprints;
  }, [projectId]);

  // return

  return blueprints;
}
