import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setBaseMapsGridModeActive } from "Features/threedEditor/threedEditorSlice";

import { selectCaptureFramingActive } from "Features/viewers/utils/effectiveViewerKey";
import { waitForViewerSwitch } from "Features/viewers/services/syncCamerasOnViewerSwitch";
import selectBaseMapsGridPinned from "Features/baseMapsGrid/utils/selectBaseMapsGridPinned";
import selectCanOpenBaseMapsGrid3d from "../utils/selectCanOpenBaseMapsGrid3d";

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
//   - pinned (SCOPE module, selectBaseMapsGridPinned): the grid is the
//     module's editor — re-opened whenever a reducer closes it, no nav
//     sprite, the selected sheet (baseMapsGrid.selectedBaseMapId) outlined.
// Mounted once (BaseMapsGrid3dController) while a 3D editor is displayed.
export default function useBaseMapsGrid3d() {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const active = useSelector((s) => s.threedEditor.baseMapsGridMode.active);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const pinned = useSelector(selectBaseMapsGridPinned);
  const canOpen = useSelector(selectCanOpenBaseMapsGrid3d);
  const selectedBaseMapId = useSelector(
    (s) => s.baseMapsGrid.selectedBaseMapId
  );
  // Pinned: the sheets follow the content selection of the scope panel
  // (ScopeGridSheetsController), not the main base map's listing.
  const scopeSheets = useSelector((s) => s.baseMapsGrid.scopeSheets);
  const scopeGridWanted = useSelector((s) => s.baseMapsGrid.scopeGridWanted);
  // Pinned: the image of a sheet follows the grid's own eye (same state as
  // the 2D grid), not the 3D eyes.
  const gridHiddenImageIds = useSelector(
    (s) => s.baseMapsGrid.hiddenImageBaseMapIds
  );

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
  const listingId = pinned
    ? scopeSheets.addListingId
    : (mainBaseMap?.listingId ?? null);
  const scopeIdSet = pinned ? new Set(scopeSheets.baseMapIds) : null;
  // what makes the table: the sheets of the listing, their frames and scales
  const sheetsKey = (baseMaps ?? [])
    .filter((baseMap) =>
      scopeIdSet ? scopeIdSet.has(baseMap.id) : baseMap.listingId === listingId
    )
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
  const hasSheets =
    (!pinned || scopeSheets.ready) &&
    buildBaseMapsGrid3dSheets({
      baseMaps,
      listingId,
      baseMapIds: pinned ? scopeSheets.baseMapIds : undefined,
      positions: {},
    }).sheets.length > 0;

  function getImageOnById(sheetIds) {
    const state = store.getState();
    const result = {};
    sheetIds.forEach((baseMapId) => {
      result[baseMapId] = pinned
        ? !state.baseMapsGrid.hiddenImageBaseMapIds.includes(baseMapId)
        : isBaseMapImageOnIn3d({
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

  // effects - SCOPE module: the grid is the landing state — opened while
  // WANTED (baseMapsGrid.scopeGridWanted: module entry / scope change, until
  // the user leaves it) after every reducer close (module / editor / scope
  // change, exit of a tool mode...). Never when the table would be empty —
  // `manager.open` then returns null and the effect below dispatches false
  // (a loop otherwise). Layout effect: dispatched before the close effect
  // below starts the flight home, so an entry from an open Dessin-3D grid
  // does not bounce.

  // Belt and braces against a loop: an opening that still found nothing to
  // lay (null result below) is not retried for the same sheets / scene.
  const failedOpenKeyRef = useRef(null);
  const openKey = `${sheetsKey}|${sceneEpoch}`;
  useLayoutEffect(() => {
    if (!pinned || !scopeGridWanted || active || !canOpen || !hasSheets) return;
    if (failedOpenKeyRef.current === openKey) return;
    dispatch(setBaseMapsGridModeActive(true));
  }, [pinned, scopeGridWanted, active, canOpen, hasSheets, openKey, dispatch]);

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
      baseMapIds: pinned ? scopeSheets.baseMapIds : undefined,
      // pinned: the "+" frame only with a selected folder
      withAddSlot: !pinned || Boolean(listingId),
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
      failedOpenKeyRef.current = `${sheetsKey}|${sceneEpoch}`;
      dispatch(setBaseMapsGridModeActive(false));
      return;
    }
    failedOpenKeyRef.current = null;
    manager.setSelected(pinned ? selectedBaseMapId : null);

    // Every opening — the SCOPE module's 2D -> 3D toggle included: the
    // synced camera cannot be trusted to frame the table (no main base
    // map, main base map off the table...), the top-down fit always runs.
    if (!cameraFittedRef.current) {
      cameraFittedRef.current = true;
      const controlsManager = editor.sceneManager.controlsManager;
      const { box, yaw } = result;
      // Top-down over the table, the sheets upright on screen (azimuth = the
      // table's yaw), while the sheets fly. After the 2D -> 3D switch
      // animation when the grid opens on a T toggle (SCOPE module): its
      // dolly-zoom would fight the fit.
      waitForViewerSwitch()
        .then(() => {
          if (!manager.isActive()) return null;
          return controlsManager?.animateToTopDown?.({
            target: box.getCenter(box.min.clone()),
            azimuthRad: yaw,
          });
        })
        .then(() => {
          if (manager.isActive()) controlsManager?.fitToBox3(box);
        });
    }
  }, [active, sheetsKey, listingId, projectId, sceneEpoch, pinned]);

  // effects - pinned grid: selected sheet outline

  useEffect(() => {
    const manager = getManager();
    if (!active || !manager?.isActive()) return;
    manager.setSelected(pinned ? selectedBaseMapId : null);
  }, [active, pinned, selectedBaseMapId]);

  // effects - image eyes → image, label and eye button of the sheets

  const imageEyesKey = [
    (visibleIds ?? []).join(","),
    hideMainImage,
    hideBaseMaps,
    mainBaseMapId,
    pinned,
    pinned ? gridHiddenImageIds.join(",") : "",
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
