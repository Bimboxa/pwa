import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useStore } from "react-redux";

import {
  setBaseMapsGridPhase,
  setBaseMapsGridListingId,
  setBaseMapsGridSelectedBaseMapId,
  setBaseMapsGridOpenFitAll,
} from "../baseMapsGridSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";
import flyCameraMatrix from "../utils/flyCameraMatrix";
import { getEditorCameraForSheetRatio } from "../utils/getAlignedCameraMatrices";

import {
  BASE_MAPS_GRID_PHASE,
  SHEET_VIEWPORT_RATIO,
  ZOOM_DURATION_MS,
} from "../constants/baseMapsGridConstants";

// Editor -> grid, first half of the transition: the editor camera zooms out
// until the sheet of the main base map covers about half of the viewport,
// then the grid layer takes over (it mounts aligned on that camera and fades
// the table + the other sheets in, see LayerBaseMapsGrid).
// `zoom: false` skips the zoom-out: the grid takes over on the current
// editor camera (SCOPE module, see BaseMapsGridPinnedController).
// `fitAll: true`: once revealed, the grid flies to the whole table instead
// of staying on the main base map's sheet (SCOPE module landing: every base
// map in sight, whichever is the main one — if any).
export default function useOpenBaseMapsGrid() {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const baseMap = useMainBaseMap();

  // refs

  const cancelFlightRef = useRef(null);
  useEffect(() => () => cancelFlightRef.current?.(), []);

  // main

  return useCallback(
    ({ zoom = true, fitAll = false } = {}) => {
      const { phase } = store.getState().baseMapsGrid;
      if (phase !== BASE_MAPS_GRID_PHASE.CLOSED) return;

      // no drawing on the editor hidden under the table
      dispatch(setEnabledDrawingMode(null));
      dispatch(setBaseMapsGridListingId(baseMap?.listingId ?? null));
      dispatch(setBaseMapsGridSelectedBaseMapId(baseMap?.id ?? null));
      dispatch(setBaseMapsGridOpenFitAll(fitAll));

      dispatch(setBaseMapsGridPhase(BASE_MAPS_GRID_PHASE.OPENING_ZOOM));

      // A module / scope switch closes the grid: a flight landing afterwards
      // must not re-open it.
      const takeOver = () => {
        const current = store.getState().baseMapsGrid.phase;
        if (current !== BASE_MAPS_GRID_PHASE.OPENING_ZOOM) return;
        dispatch(setBaseMapsGridPhase(BASE_MAPS_GRID_PHASE.OPENING_FADE));
      };

      const mapEditor = getActiveMapEditor();
      const from = mapEditor?.getCameraMatrix?.();
      const viewport = mapEditor?.getViewportSize?.();
      const to = getEditorCameraForSheetRatio({
        printZone: baseMap?.getPrintZone?.(),
        viewport,
        ratio: SHEET_VIEWPORT_RATIO,
      });
      if (!zoom || !from || !to) {
        takeOver();
        return;
      }

      cancelFlightRef.current = flyCameraMatrix({
        from,
        to,
        center: { x: viewport.width / 2, y: viewport.height / 2 },
        durationMs: ZOOM_DURATION_MS,
        onTick: (matrix) => mapEditor.setCameraMatrix?.(matrix),
        onDone: takeOver,
      });
    },
    [baseMap, dispatch, store]
  );
}
