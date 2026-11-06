import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Whether the project has a « Scène 3D » base map made from a GLB kept as a
// model (scene3d.format "GLB"): gates the bottom bar « Filaire » toggle.
export default function useHasGlbSceneBaseMaps() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  return (
    useLiveQuery(async () => {
      if (!projectId) return false;
      const count = await db.baseMaps
        .where("projectId")
        .equals(projectId)
        .filter((b) => !b.deletedAt && b.scene3d?.format === "GLB")
        .count();
      return count > 0;
    }, [projectId]) ?? false
  );
}
