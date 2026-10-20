import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setBaseMapsGridModeActive } from "Features/threedEditor/threedEditorSlice";

import { selectCaptureFramingActive } from "Features/viewers/utils/effectiveViewerKey";
import { waitForViewerSwitch } from "Features/viewers/services/syncCamerasOnViewerSwitch";
import selectBaseMapsGridPinned from "Features/baseMapsGrid/utils/selectBaseMapsGridPinned";
import selectBaseMapsGridDessin from "Features/baseMapsGrid/utils/selectBaseMapsGridDessin";
import selectCanOpenBaseMapsGrid3d from "../utils/selectCanOpenBaseMapsGrid3d";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useDessinGridBaseMapIds from "./useDessinGridBaseMapIds";
import { readBaseMapsGridPositions } from "Features/baseMapsGrid/hooks/useBaseMapsGridLayout";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import buildBaseMapsGrid3dSheets from "../utils/buildBaseMapsGrid3dSheets";
import {
  isBaseMapAnnotationsOnIn3d,
  isBaseMapImageOnIn3d,
} from "../utils/baseMapImageEyeIn3d";
import selectHideBaseMapImagesIn3d from "Features/threedEditor/utils/selectHideBaseMapImagesIn3d";

const EMPTY_COUNTS = {};

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
//   - Dessin module (selectBaseMapsGridDessin): direct display — every base
//     map of the scope on the table (preview images for the ones that do
//     not take part in the scene), the image of a sheet whose eye is off
//     greyed instead of removed, an annotations badge (count, same state
//     as the "Fonds de plan" rows) next to the eye of each sheet. The "+"
//     frame creates in the folder of the main base map.
// Mounted once (BaseMapsGrid3dController) while a 3D editor is displayed.
// `countByBaseMapId`: annotations built in the scene per base map (badges).
export default function useBaseMapsGrid3d({
  countByBaseMapId = EMPTY_COUNTS,
} = {}) {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const active = useSelector((s) => s.threedEditor.baseMapsGridMode.active);
  const closeEpoch = useSelector(
    (s) => s.threedEditor.baseMapsGridMode.closeEpoch
  );
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const pinned = useSelector(selectBaseMapsGridPinned);
  const dessin = useSelector(selectBaseMapsGridDessin);
  const dessinIds = useDessinGridBaseMapIds();
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
  // annotations badges (Dessin)
  const hideMainAnnotations = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
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
  // badges of the sheets at the opening (kept current by its own effect)
  const countByBaseMapIdRef = useRef(countByBaseMapId);
  countByBaseMapIdRef.current = countByBaseMapId;
  // the camera goes over the table once per opening, not on a re-entry
  const cameraFittedRef = useRef(false);

  // helpers

  const mainBaseMapId = mainBaseMap?.id ?? null;
  const listingId = pinned
    ? scopeSheets.addListingId
    : (mainBaseMap?.listingId ?? null);
  // explicit sheet set: the scope selection (pinned), every base map of the
  // scope (Dessin); the main base map's listing otherwise
  const explicitIds = pinned
    ? scopeSheets.baseMapIds
    : dessin
      ? dessinIds
      : null;
  const explicitIdSet = explicitIds ? new Set(explicitIds) : null;
  // the "+" frame: a listing to create in (pinned: a selected folder only)
  const withAddSlot = pinned || dessin ? Boolean(listingId) : true;
  // what makes the table: the sheets, their frames and scales
  const sheetsKey = (baseMaps ?? [])
    .filter((baseMap) =>
      explicitIdSet
        ? explicitIdSet.has(baseMap.id)
        : baseMap.listingId === listingId
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
      baseMapIds: explicitIds ?? undefined,
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

  // Dessin: the annotations badge of each sheet (3D badge of the rows).
  function getAnnotationsOnById(sheetIds) {
    const state = store.getState();
    const result = {};
    sheetIds.forEach((baseMapId) => {
      result[baseMapId] = isBaseMapAnnotationsOnIn3d({
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
  }, [
    pinned,
    scopeGridWanted,
    active,
    closeEpoch,
    canOpen,
    hasSheets,
    openKey,
    dispatch,
  ]);

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
      baseMapIds: explicitIds ?? undefined,
      withAddSlot,
      positions: readBaseMapsGridPositions(projectId),
    });
    const sheetIds = sheets.map((s) => s.id);
    const result = manager.open({
      sheets,
      addSlot,
      anchorBaseMapId: mainBaseMapId,
      imageOnById: getImageOnById(sheetIds),
      hideBaseMaps: selectHideBaseMapImagesIn3d(store.getState()),
      // Dessin: direct display (see the header comment)
      fadeHidden: dessin,
      preview: dessin,
      showBadge: dessin,
      annotationsOnById: dessin ? getAnnotationsOnById(sheetIds) : {},
      countById: countByBaseMapIdRef.current,
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
      const sceneManager = editor.sceneManager;
      const controlsManager = sceneManager.controlsManager;
      const { box, yaw } = result;
      // Top-down over the table, the sheets upright on screen (azimuth = the
      // table's yaw), while the sheets fly. After the 2D -> 3D switch
      // animation when the grid opens on a T toggle (SCOPE module): its
      // dolly-zoom would fight the fit. The editor chrome hidden by the grid
      // (Dessin module) leaves in the same commit: the canvas is re-synced
      // to its container before the camera frames the table.
      waitForViewerSwitch()
        .then(() => {
          if (!manager.isActive()) return null;
          sceneManager.ensureSizeSynced?.();
          return controlsManager?.animateToTopDown?.({
            target: box.getCenter(box.min.clone()),
            azimuthRad: yaw,
          });
        })
        .then(() => {
          if (!manager.isActive()) return;
          sceneManager.ensureSizeSynced?.();
          controlsManager?.fitToBox3(box);
        });
    }
  }, [active, sheetsKey, listingId, projectId, sceneEpoch, pinned, dessin]);

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

  // effects - Dessin: annotations badges (state + count) of the sheets

  const annotationsBadgesKey = dessin
    ? [
        hideMainAnnotations,
        mainBaseMapId,
        Object.entries(annotationsModeByBaseMapId ?? {})
          .map(([id, mode]) => `${id}:${mode}`)
          .join(","),
      ].join("|")
    : "";
  useEffect(() => {
    const manager = getManager();
    if (!active || !dessin || !manager?.isActive()) return;
    manager.setAnnotationsOnById(
      getAnnotationsOnById([...manager.sheetsById.keys()])
    );
  }, [active, dessin, annotationsBadgesKey]);

  useEffect(() => {
    const manager = getManager();
    if (!active || !dessin || !manager?.isActive()) return;
    manager.setAnnotationsCountById(countByBaseMapId);
  }, [active, dessin, countByBaseMapId]);

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
