import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

// All REVOLUTION_AXIS annotations of the current project. These are the
// elevation-view axes the user can pick from when assigning a REVOLUTION
// shape3D to an arc, or when linking a plan-view point to an axis. Project-wide
// (not base-map scoped) since an axis drawn on one elevation can drive arcs on
// the same or other base maps.
export default function useRevolutionAxes() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const axes = useLiveQuery(async () => {
    if (!projectId) return [];
    const rows = await db.annotations
      .where("projectId")
      .equals(projectId)
      .toArray();
    return rows.filter((a) => !a.deletedAt && a.type === "REVOLUTION_AXIS");
  }, [projectId, annotationsUpdatedAt]);

  return axes ?? [];
}
