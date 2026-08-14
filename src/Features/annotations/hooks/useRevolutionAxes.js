import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";
import { isLegacyRevolutionRecord } from "Features/annotations/constants/drawingShapeConfig";
import isRevolutionHelperInScope, {
  getScopeIdByListingId,
} from "Features/annotations/utils/isRevolutionHelperInScope";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

// REVOLUTION_AXIS annotations of the current project AND scope. These are the
// PLAN-view axes the user can pick from when assigning a REVOLUTION shape3D to
// an arc, or when dropping an axis on a vertical base map. Project-wide (not
// base-map scoped) since one axis drives arcs on every elevation that carries a
// REVOLUTION_AXIS_PLACEMENT of it — but scope-filtered: every consumer is a
// current-scope picker, and another scope's axes must not be offered (nor
// counted as duplicates).
export default function useRevolutionAxes() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const { value: scope } = useSelectedScope();
  const scopeId = scope?.id;

  const axes = useLiveQuery(async () => {
    if (!projectId) return [];
    const rows = await db.annotations
      .where("projectId")
      .equals(projectId)
      .toArray();
    // Axes of the previous model are skipped: they carry no radius/orientation,
    // so they can neither be drawn nor placed (see isLegacyRevolutionRecord).
    const allAxes = rows.filter(
      (a) =>
        !a.deletedAt &&
        a.type === "REVOLUTION_AXIS" &&
        !isLegacyRevolutionRecord(a)
    );

    const scopeIdByListingId = await getScopeIdByListingId(allAxes);
    return allAxes.filter((a) =>
      isRevolutionHelperInScope(a, { scopeId, scopeIdByListingId })
    );
  }, [projectId, annotationsUpdatedAt, scopeId]);

  return axes ?? [];
}
