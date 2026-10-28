import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";

// Whether the scope shows a base map projected from a local point cloud
// (baseMap.localScan) in one of its ACTIVE folders (listings not hidden by
// the scope): gates the Scan 3D tool of the right band, which only edits
// such base maps.
export default function useHasLocalScanBaseMaps() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { disabledListingIds } = useDisabledBaseMapListingIds();
  return (
    useLiveQuery(async () => {
      if (!projectId) return false;
      const count = await db.baseMaps
        .where("projectId")
        .equals(projectId)
        .filter(
          (b) =>
            !b.deletedAt &&
            Boolean(b.localScan?.resourceId) &&
            !disabledListingIds.includes(b.listingId)
        )
        .count();
      return count > 0;
    }, [projectId, disabledListingIds]) ?? false
  );
}
