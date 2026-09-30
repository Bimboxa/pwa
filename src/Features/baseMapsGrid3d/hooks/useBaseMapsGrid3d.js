import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setBaseMapsGridAnchorId,
  setBaseMapsGridModeActive,
} from "Features/threedEditor/threedEditorSlice";

import { selectCaptureFramingActive } from "Features/viewers/utils/effectiveViewerKey";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { readBaseMapsGridPositions } from "Features/baseMapsGrid/hooks/useBaseMapsGridLayout";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import buildBaseMapsGrid3dSheets from "../utils/buildBaseMapsGrid3dSheets";
import { isBaseMapContentVisibleIn3d } from "../utils/baseMapContentVisibilityIn3d";

function getManager() {
  return getActiveThreedEditor()?.sceneManager?.baseMapsGridManager ?? null;
}

// Drives BaseMapsGridManager from redux (`threedEditor.baseMapsGridMode`):
//   - active: the base maps of the main base map's listing fly to the table,
//     arranged like the 2D grid (same paper sheets, same positions — read
//     from the 2D grid's localStorage layout each time the grid opens); the
//     camera goes top-down over the table. Inactive: they fly back, the
//     camera is left where it is.
//   - anchor / layout: a click on a sheet lays the others around it.
//   - content visibility (image / annotations eyes) → label + eye button.
// Mounted once (BaseMapsGrid3dController) while a 3D editor is displayed.
export default function useBaseMapsGrid3d() {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const active = useSelector((s) => s.threedEditor.baseMapsGridMode.active);
  const anchorBaseMapId = useSelector(
    (s) => s.threedEditor.baseMapsGridMode.anchorBaseMapId
  );
  const layout = useSelector((s) => s.threedEditor.baseMapsGridMode.layout);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const captureFramingActive = useSelector(selectCaptureFramingActive);

  const visibleIds = useSelector((s) => s.threedEditor.visibleBaseMapIdsIn3d);
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const hideMainImage = useSelector(
    (s) => s.threedEditor.hideMainBaseMapImageIn3d
  );
  const hideMainAnnotations = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );

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

  function getContentVisibleById(sheetIds) {
    const state = store.getState();
    const result = {};
    sheetIds.forEach((baseMapId) => {
      result[baseMapId] = isBaseMapContentVisibleIn3d({
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

    const sheets = buildBaseMapsGrid3dSheets({
      baseMaps: baseMapsRef.current,
      listingId,
      positions: readBaseMapsGridPositions(projectId),
    });
    const gridState = store.getState().threedEditor.baseMapsGridMode;
    const result = manager.open({
      sheets,
      anchorBaseMapId: gridState.anchorBaseMapId ?? mainBaseMapId,
      layout: gridState.layout,
      contentVisibleById: getContentVisibleById(sheets.map((s) => s.id)),
    });
    if (!result) {
      // nothing to lay on the table
      dispatch(setBaseMapsGridModeActive(false));
      return;
    }
    if (gridState.anchorBaseMapId !== manager.anchorId) {
      dispatch(setBaseMapsGridAnchorId(manager.anchorId));
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
    // anchor / layout changes are handled by the effect below
  }, [active, sheetsKey, listingId, projectId, sceneEpoch]);

  // effects - anchor / layout (click on a sheet)

  useEffect(() => {
    const manager = getManager();
    if (!active || !manager?.isActive() || !anchorBaseMapId) return;
    if (manager.anchorId === anchorBaseMapId && manager.layout === layout) {
      return;
    }
    manager.setAnchor(anchorBaseMapId, layout);
  }, [active, anchorBaseMapId, layout]);

  // effects - content visibility → label + eye button

  const visibilityKey = [
    (visibleIds ?? []).join(","),
    Object.entries(annotationsModeByBaseMapId ?? {})
      .map(([id, mode]) => `${id}:${mode}`)
      .join(","),
    hideMainImage,
    hideMainAnnotations,
    mainBaseMapId,
  ].join("|");

  useEffect(() => {
    const manager = getManager();
    if (!active || !manager?.isActive()) return;
    manager.setContentVisibleById(
      getContentVisibleById([...manager.sheetsById.keys()])
    );
  }, [active, visibilityKey]);

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
