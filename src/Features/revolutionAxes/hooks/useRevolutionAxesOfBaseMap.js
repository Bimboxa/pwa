import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";
import {
  isLegacyRevolutionRecord,
  isRevolutionHelperType,
} from "Features/annotations/constants/drawingShapeConfig";
import isRevolutionHelperInScope, {
  getScopeIdByListingId,
} from "Features/annotations/utils/isRevolutionHelperInScope";

import getRevolutionAxisIdOfAnnotation from "../utils/getRevolutionAxisIdOfAnnotation";

const EMPTY = [];

// Revolution axes of the selected scope that concern a base map: the axes
// DRAWN on it (plan view) and the axes PLACED on it (vertical base map, via a
// REVOLUTION_AXIS_PLACEMENT). Read straight from Dexie (not from
// useAnnotationsV2) so an axis hidden from the views keeps its row — which is
// where its eye lives.
//
// Returns [{ axis, placements, linkedCount }]:
// - placements: every placement of the axis (all vertical base maps);
// - linkedCount: annotations revolved around the axis (profiles, circles).
export default function useRevolutionAxesOfBaseMap(baseMapId) {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const items = useLiveQuery(async () => {
    if (!projectId || !baseMapId) return EMPTY;
    const rows = (
      await db.annotations.where("projectId").equals(projectId).toArray()
    ).filter((a) => !a.deletedAt);

    const helpers = rows.filter(
      (a) => isRevolutionHelperType(a.type) && !isLegacyRevolutionRecord(a)
    );
    const scopeIdByListingId = await getScopeIdByListingId(helpers);
    const helpersInScope = helpers.filter((a) =>
      isRevolutionHelperInScope(a, { scopeId, scopeIdByListingId })
    );

    const placementsByAxisId = new Map();
    for (const a of helpersInScope) {
      if (a.type !== "REVOLUTION_AXIS_PLACEMENT" || !a.revolutionAxisId)
        continue;
      if (!placementsByAxisId.has(a.revolutionAxisId))
        placementsByAxisId.set(a.revolutionAxisId, []);
      placementsByAxisId.get(a.revolutionAxisId).push(a);
    }

    const linkedCountByAxisId = new Map();
    for (const a of rows) {
      if (isRevolutionHelperType(a.type)) continue;
      const axisId = getRevolutionAxisIdOfAnnotation(a);
      if (!axisId) continue;
      linkedCountByAxisId.set(
        axisId,
        (linkedCountByAxisId.get(axisId) ?? 0) + 1
      );
    }

    return helpersInScope
      .filter((a) => a.type === "REVOLUTION_AXIS")
      .map((axis) => ({
        axis,
        placements: placementsByAxisId.get(axis.id) ?? [],
        linkedCount: linkedCountByAxisId.get(axis.id) ?? 0,
      }))
      .filter(
        ({ axis, placements }) =>
          axis.baseMapId === baseMapId ||
          placements.some((p) => p.baseMapId === baseMapId)
      )
      .sort((a, b) =>
        String(a.axis.label ?? "").localeCompare(
          String(b.axis.label ?? ""),
          undefined,
          { numeric: true }
        )
      );
  }, [projectId, scopeId, baseMapId, annotationsUpdatedAt]);

  return items ?? EMPTY;
}
