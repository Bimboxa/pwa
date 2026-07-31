import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";
import { isLegacyRevolutionRecord } from "Features/annotations/constants/drawingShapeConfig";

// All REVOLUTION_AXIS annotations of the current project. These are the
// PLAN-view axes the user can pick from when assigning a REVOLUTION shape3D to
// an arc, or when dropping an axis on a vertical base map. Project-wide (not
// base-map scoped) since one axis drives arcs on every elevation that carries a
// REVOLUTION_AXIS_PLACEMENT of it.
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
    // Axes of the previous model are skipped: they carry no radius/orientation,
    // so they can neither be drawn nor placed (see isLegacyRevolutionRecord).
    return rows.filter(
      (a) =>
        !a.deletedAt &&
        a.type === "REVOLUTION_AXIS" &&
        !isLegacyRevolutionRecord(a)
    );
  }, [projectId, annotationsUpdatedAt]);

  return axes ?? [];
}
