import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setBaseMapsGridModeActive } from "Features/threedEditor/threedEditorSlice";

import { selectCaptureFramingActive } from "Features/viewers/utils/effectiveViewerKey";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { readBaseMapsGridPositions } from "Features/baseMapsGrid/hooks/useBaseMapsGridLayout";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import buildBaseMapsGrid3dSheets from "../utils/buildBaseMapsGrid3dSheets";
import { isBaseMapImageOnIn3d } from "../utils/baseMapImageEyeIn3d";
import selectHideBaseMapImagesIn3d from "Features/threedEditor/utils/selectHideBaseMapImagesIn3d";

function getManager() {
  return getActiveThreedEditor()?.sceneManager?.baseMapsGridManager ?? null;
}

// Drives BaseMapsGridManager from redux (`threedEditor.baseMapsGridMode`):
//   - active: the base maps of the main base map's listing fly to the table,
//     arranged like the 2D grid (same paper sheets, same positions — read
//     from the 2D grid's localStorage layout each time the grid opens); the
//     camera goes top-down over the table. Inactive: they fly back, the
//     camera is left where it is.
//     The main base map is the anchor of the table: it does not move.
//     The "new base map" frame closes the table, at the slot of the 2D
//     grid's "+" frame.
//   - image eyes (same state as the chips' layer icon) → image, label and
//     eye button of each sheet.
// Mounted once (BaseMapsGrid3dController) while a 3D editor is displayed.
export default function useBaseMapsGrid3d() {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const active = useSelector((s) => s.threedEditor.baseMapsGridMode.active);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const captureFramingActive = useSelector(selectCaptureFramingActive);

  const visibleIds = useSelector((s) => s.threedEditor.visibleBaseMapIdsIn3d);
  const hideMainImage = useSelector(
    (s) => s.threedEditor.hideMainBaseMapImageIn3d
  );
  // 3D "Masquer les fonds de plan" switch OR global image mode NONE
  const hideBaseMaps = useSelector(selectHideBaseMapImagesIn3d);

  const mainBaseMap = useMainBaseMap();
  const { value: baseMaps } = useBaseMaps();

  // state

  // bumped when the scene dropped the groups under the open grid (reload)
  const [sceneEpoch, setSceneEpoch] = useState(0);

  // refs

  const baseMapsRef = useRef(baseMaps);
  baseMapsRef.current = baseMaps;
  // the camera goes over the table once per opening, not on a re-entry
  const cameraFittedRef = useRef(false);

  // helpers

  const mainBaseMapId = mainBaseMap?.id ?? null;
  const listingId = mainBaseMap?.listingId ?? null;
  // what makes the table: the sheets of the listing, their frames and scales
  const sheetsKey = (baseMaps ?? [])
    .filter((baseMap) => baseMap.listingId === listingId)
    .map((baseMap) => {
      const zone = baseMap.getPrintZone?.();
      return [
        baseMap.id,
        baseMap.name,
        baseMap.meterByPx,
        zone?.format,
        zone?.orientation,
        zone?.x,
        zone?.y,
        zone?.width,
      ].join(":");
    })
    .join("|");

  function getImageOnById(sheetIds) {
    const state = store.getState();
    const result = {};
    sheetIds.forEach((baseMapId) => {
      result[baseMapId] = isBaseMapImageOnIn3d({
        threedEditor: state.threedEditor,
        mainBaseMapId: state.mapEditor.selectedBaseMapId,
        baseMapId,
      });
    });
    return result;
  }

  // effects - scene reload under the open grid

  useEffect(() => {
    const manager = getManager();
    if (!manager) return undefined;
    return manager.subscribeInvalidated(() => setSceneEpoch((n) => n + 1));
  }, []);

  // effects - open / close

  useEffect(() => {
    const editor = getActiveThreedEditor();
    const manager = getManager();
    if (!manager) return;

    if (!active) {
      cameraFittedRef.current = false;
      manager.close();
      return;
    }

    const { sheets, addSlot } = buildBaseMapsGrid3dSheets({
      baseMaps: baseMapsRef.current,
      listingId,
      positions: readBaseMapsGridPositions(projectId),
    });
    const result = manager.open({
      sheets,
      addSlot,
      anchorBaseMapId: mainBaseMapId,
      imageOnById: getImageOnById(sheets.map((s) => s.id)),
      hideBaseMaps: selectHideBaseMapImagesIn3d(store.getState()),
    });
    if (!result) {
      // nothing to lay on the table
      dispatch(setBaseMapsGridModeActive(false));
      return;
    }

    if (!cameraFittedRef.current) {
      cameraFittedRef.current = true;
      const controlsManager = editor.sceneManager.controlsManager;
      const { box, yaw } = result;
      // Top-down over the table, the sheets upright on screen (azimuth = the
      // table's yaw), while the sheets fly.
      controlsManager
        ?.animateToTopDown?.({
          target: box.getCenter(box.min.clone()),
          azimuthRad: yaw,
        })
        ?.then(() => {
          if (manager.isActive()) controlsManager.fitToBox3(box);
        });
    }
  }, [active, sheetsKey, listingId, projectId, sceneEpoch]);

  // effects - image eyes → image, label and eye button of the sheets

  const imageEyesKey = [
    (visibleIds ?? []).join(","),
    hideMainImage,
    hideBaseMaps,
    mainBaseMapId,
  ].join("|");

  useEffect(() => {
    const manager = getManager();
    if (!active || !manager?.isActive()) return;
    manager.setImageOnById(getImageOnById([...manager.sheetsById.keys()]), {
      hideBaseMaps,
    });
  }, [active, imageEyesKey]);

  // effects - a capture framing never snapshots the table

  useEffect(() => {
    if (active && captureFramingActive) {
      dispatch(setBaseMapsGridModeActive(false));
    }
  }, [active, captureFramingActive, dispatch]);

  // effects - the 3D editor leaves the screen: real poses at once

  useEffect(() => {
    return () => {
      getManager()?.close({ instant: true });
      dispatch(setBaseMapsGridModeActive(false));
    };
  }, [dispatch]);
}
