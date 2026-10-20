import { useCallback } from "react";
import { useDispatch, useStore } from "react-redux";

import { setBaseMapsGridModeActive } from "Features/threedEditor/threedEditorSlice";
import {
  setBaseMapsGridSelectedBaseMapId,
  setScopeGridWanted,
} from "Features/baseMapsGrid/baseMapsGridSlice";

import useSelectMainBaseMap from "Features/threedEditor/hooks/useSelectMainBaseMap";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import selectBaseMapsGridPinned from "Features/baseMapsGrid/utils/selectBaseMapsGridPinned";
import selectBaseMapsGridDessin from "Features/baseMapsGrid/utils/selectBaseMapsGridDessin";
import {
  getToggleBaseMapImageIn3dAction,
  isBaseMapAnnotationsOnIn3d,
  isBaseMapImageOnIn3d,
} from "../utils/baseMapImageEyeIn3d";

// Closes the 3D base maps grid (G, Escape, the bottom bar button):
//   - SCOPE module: drops `scopeGridWanted` so the keeper lets it closed;
//   - Dessin module with a sheet selected on the table (a click on it, see
//     useBaseMapsGrid3dPointer) other than the main base map: the table
//     closes AROUND that sheet — it stays where it is on screen while the
//     others fly home (BaseMapsGridManager.closeAround) — and the base map
//     becomes the main one once the flight has landed (a main change
//     reloads the scene: done after the flight, not during it);
//   - otherwise the regular flight home.
// The state is read from the store at call time (hotkey listener).
export default function useCloseBaseMapsGrid3d() {
  const dispatch = useDispatch();
  const store = useStore();
  const selectMainBaseMap = useSelectMainBaseMap();

  return useCallback(() => {
    const state = store.getState();
    if (!state.threedEditor.baseMapsGridMode.active) return;
    const manager = getActiveThreedEditor()?.sceneManager?.baseMapsGridManager;

    if (selectBaseMapsGridPinned(state)) dispatch(setScopeGridWanted(false));

    if (selectBaseMapsGridDessin(state)) {
      const selectedId = state.baseMapsGrid.selectedBaseMapId;
      const mainId = state.mapEditor.selectedBaseMapId;
      dispatch(setBaseMapsGridSelectedBaseMapId(null));
      if (selectedId && selectedId !== mainId && manager?.isSheet(selectedId)) {
        // A sheet showing nothing would vanish once out of the grid (its
        // group does not take part in the scene until it is the main base
        // map): its image is turned on, like the nav sprite does.
        const args = {
          threedEditor: state.threedEditor,
          mainBaseMapId: mainId,
          baseMapId: selectedId,
        };
        if (!isBaseMapImageOnIn3d(args) && !isBaseMapAnnotationsOnIn3d(args)) {
          dispatch(getToggleBaseMapImageIn3dAction(args));
        }
        manager.closeAround(selectedId, {
          onClosed: () => selectMainBaseMap(selectedId),
        });
      }
    }

    dispatch(setBaseMapsGridModeActive(false));
  }, [dispatch, store, selectMainBaseMap]);
}
