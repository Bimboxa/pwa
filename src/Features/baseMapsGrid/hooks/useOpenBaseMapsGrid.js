import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useStore } from "react-redux";

import {
  setBaseMapsGridPhase,
  setBaseMapsGridListingId,
  setBaseMapsGridSelectedBaseMapId,
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
export default function useOpenBaseMapsGrid() {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const baseMap = useMainBaseMap();

  // refs

  const cancelFlightRef = useRef(null);
  useEffect(() => () => cancelFlightRef.current?.(), []);

  // main

  return useCallback(() => {
    const { phase } = store.getState().baseMapsGrid;
    if (phase !== BASE_MAPS_GRID_PHASE.CLOSED) return;

    // no drawing on the editor hidden under the table
    dispatch(setEnabledDrawingMode(null));
    dispatch(setBaseMapsGridListingId(baseMap?.listingId ?? null));
    dispatch(setBaseMapsGridSelectedBaseMapId(baseMap?.id ?? null));

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
    if (!from || !to) {
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
  }, [baseMap, dispatch, store]);
}
