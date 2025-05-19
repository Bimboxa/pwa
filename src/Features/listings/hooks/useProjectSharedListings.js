import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

import {useSelector} from "react-redux";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

export default function useProjectSharedListings() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const {value: scope} = useSelectedScope();

  const takenIds = scope?.sortedListings?.map((l) => l.id);

  let listings = useLiveQuery(async () => {
    if (scope?.id && projectId) {
      const _listings = await db.listings
        .where("projectId")
        .equals(projectId)
        .toArray();

      return _listings?.filter((l) => !takenIds?.includes(l.id));
    }
  }, [projectId, scope?.id]);

  return listings;
}
