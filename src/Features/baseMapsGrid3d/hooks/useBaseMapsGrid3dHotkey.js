import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import { setBaseMapsGridModeActive } from "Features/threedEditor/threedEditorSlice";

import useCloseBaseMapsGrid3d from "./useCloseBaseMapsGrid3d";

import { BASE_MAPS_GRID_HOTKEY } from "Features/baseMapsGrid/hooks/useOpenBaseMapsGridHotkey";
import isEditableTarget from "Features/baseMapsGrid/utils/isEditableTarget";
import selectCanOpenBaseMapsGrid3d from "../utils/selectCanOpenBaseMapsGrid3d";

// "G" toggles the base maps grid of the displayed 3D editor (same key as the
// 2D grid, whose own hotkey is inert while a 3D editor is displayed); Escape
// closes it (useCloseBaseMapsGrid3d: SCOPE keeper let closed, Dessin table
// closed around the selected sheet). Plain key only, never while typing. The
// state is read from the store at key time, so the listener never
// re-attaches.
export default function useBaseMapsGrid3dHotkey() {
  const dispatch = useDispatch();
  const store = useStore();
  const closeGrid = useCloseBaseMapsGrid3d();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;

      const s = store.getState();
      const active = s.threedEditor.baseMapsGridMode.active;

      if (e.key === "Escape") {
        if (active) closeGrid();
        return;
      }

      if (e.key.toLowerCase() !== BASE_MAPS_GRID_HOTKEY.toLowerCase()) return;
      if (active) {
        closeGrid();
      } else if (selectCanOpenBaseMapsGrid3d(s)) {
        dispatch(setBaseMapsGridModeActive(true));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, store, closeGrid]);
}
