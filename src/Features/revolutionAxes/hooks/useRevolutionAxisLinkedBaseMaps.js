import { useMemo } from "react";
import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useRevolutionAxesOfBaseMap from "./useRevolutionAxesOfBaseMap";

const EMPTY = [];

// Vertical base maps a plan axis is placed on (one REVOLUTION_AXIS_PLACEMENT
// each) — the pages its profiles are drawn on. Same source as the axes
// section of PopperMapListings (useRevolutionAxesOfBaseMap, read straight
// from Dexie), so the overlay and the section always agree.
//
// Returns { linkedBaseMaps, goTo(baseMapId) }.
export default function useRevolutionAxisLinkedBaseMaps(axis) {
  const dispatch = useDispatch();

  // data

  const items = useRevolutionAxesOfBaseMap(axis?.baseMapId);
  const { value: baseMaps } = useBaseMaps({ includeDetails: true });

  // helpers

  const linkedBaseMaps = useMemo(() => {
    const item = items.find((it) => it.axis.id === axis?.id);
    if (!item) return EMPTY;
    const byId = new Map((baseMaps ?? []).map((bm) => [bm.id, bm]));
    return item.placements
      .map((p) => byId.get(p.baseMapId))
      .filter((bm) => bm && !bm.deletedAt);
  }, [items, baseMaps, axis?.id]);

  // handlers

  const goTo = (baseMapId) => {
    if (baseMapId) dispatch(setSelectedMainBaseMapId(baseMapId));
  };

  return { linkedBaseMaps, goTo };
}
