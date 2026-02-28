import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

import {useSelector} from "react-redux";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

export default function useProjectSharedListings() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const {value: scope} = useSelectedScope();

  let listings = useLiveQuery(async () => {
    if (scope?.id && projectId) {
      const _listings = (await db.listings
        .where("projectId")
        .equals(projectId)
        .toArray()).filter(r => !r.deletedAt);

      // show listings not yet assigned to any scope (available for assignment)
      return _listings?.filter((l) => !l.scopeId);
    }
  }, [projectId, scope?.id]);

  return listings;
}
