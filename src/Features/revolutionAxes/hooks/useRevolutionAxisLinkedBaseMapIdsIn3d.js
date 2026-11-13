import { useMemo } from "react";
import { useSelector } from "react-redux";

import { selectHiddenLinkedAnnotationsRevolutionAxisIdSet } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import useRevolutionAxesOfBaseMap from "./useRevolutionAxesOfBaseMap";

const EMPTY_IDS = [];
const EMPTY_SET = new Set();

/**
 * 3D scene, main base map = the plan view of revolution axes: the base maps
 * (coupes) the profiles of those axes are drawn on, so the annotations
 * revolved around the axes show on the plan without switching each coupe on.
 * An axis whose linked-annotations chip is off (SectionRevolutionAxes rows)
 * brings nothing.
 *
 * Returns { baseMapIds, axisIdSet } — `axisIdSet`: the plan axes concerned
 * (the loader keeps, on a base map loaded for this only, the annotations
 * revolved around one of them). Identities only change with their content.
 */
export default function useRevolutionAxisLinkedBaseMapIdsIn3d() {
  // data

  const mainBaseMap = useMainBaseMap();
  const mainBaseMapId = mainBaseMap?.id ?? null;
  const items = useRevolutionAxesOfBaseMap(mainBaseMapId);
  const hiddenLinkedAxisIdSet = useSelector(
    selectHiddenLinkedAnnotationsRevolutionAxisIdSet
  );

  // helpers

  const key = useMemo(() => {
    const axisIds = [];
    const baseMapIds = new Set();
    for (const { axis, placements, linkedCount } of items) {
      if (axis.baseMapId !== mainBaseMapId) continue;
      if (!linkedCount || hiddenLinkedAxisIdSet.has(axis.id)) continue;
      axisIds.push(axis.id);
      placements.forEach((p) => {
        if (p.baseMapId && p.baseMapId !== mainBaseMapId)
          baseMapIds.add(p.baseMapId);
      });
    }
    return `${axisIds.sort().join(",")}|${[...baseMapIds].sort().join(",")}`;
  }, [items, mainBaseMapId, hiddenLinkedAxisIdSet]);

  return useMemo(() => {
    const [axisIdsKey, baseMapIdsKey] = key.split("|");
    return {
      baseMapIds: baseMapIdsKey ? baseMapIdsKey.split(",") : EMPTY_IDS,
      axisIdSet: axisIdsKey ? new Set(axisIdsKey.split(",")) : EMPTY_SET,
    };
  }, [key]);
}
