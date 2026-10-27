import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Whether the project has a base map carrying a scan (local point cloud or
// « Scène 3D » mesh): gates the bottom bar « Scan 3D » selector.
export default function useHasScanBaseMaps() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  return (
    useLiveQuery(async () => {
      if (!projectId) return false;
      const count = await db.baseMaps
        .where("projectId")
        .equals(projectId)
        .filter((b) => !b.deletedAt && Boolean(b.localScan || b.scene3d))
        .count();
      return count > 0;
    }, [projectId]) ?? false
  );
}
