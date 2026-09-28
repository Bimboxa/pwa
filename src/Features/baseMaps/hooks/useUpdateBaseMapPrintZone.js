import { useCallback } from "react";
import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import db from "App/db/db";
import { roundPrintZone } from "Features/baseMaps/utils/printZone";

// Single write path of baseMap.printZone (panel fields AND the map-editor
// overlay drag). Direct db write: detail base maps have no listing, so
// useUpdateEntity would target the wrong table (same as detailRef).
// `printZone` null removes the zone.
export default function useUpdateBaseMapPrintZone() {
  const dispatch = useDispatch();

  return useCallback(
    async (baseMapId, printZone) => {
      if (!baseMapId) return;
      await db.baseMaps.update(baseMapId, {
        printZone: printZone ? roundPrintZone(printZone) : null,
      });
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
    },
    [dispatch]
  );
}
