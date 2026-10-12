import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setBaseMapsGridPhase,
  setBaseMapsGridListingId,
  setBaseMapsGridSelectedBaseMapId,
  setScopeGridWanted,
  setBaseMapsGridOpenFitAll,
} from "../baseMapsGridSlice";
import {
  setSelectedBaseMapsListingId,
  setShowCreateBaseMapSection,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationsCountByBaseMapId from "Features/annotations/hooks/useAnnotationsCountByBaseMapId";
import useSelectMainBaseMap from "Features/threedEditor/hooks/useSelectMainBaseMap";
import useBaseMapsGridAnnotations from "../hooks/useBaseMapsGridAnnotations";
import useBaseMapsGridLayout from "../hooks/useBaseMapsGridLayout";
import useScopeGridAnnotationsFilter from "Features/listingViewer/hooks/useScopeGridAnnotationsFilter";

import { Box } from "@mui/material";
import {
  AlignHorizontalLeft,
  RestartAlt,
  OpenWith,
  GridView,
  ZoomOutMap,
} from "@mui/icons-material";

import MapEditorViewport from "Features/mapEditorGeneric/components/MapEditorViewport";
import BaseMapSheetSvg, {
  SHEET_LIFTED_SHADOW_FILTER_ID,
  SHEET_SHADOW_FILTER_ID,
} from "./BaseMapSheetSvg";
import AddBaseMapSheetSvg from "./AddBaseMapSheetSvg";
import BaseMapsGridTabs from "./BaseMapsGridTabs";
import ButtonBaseMapsGrid from "./ButtonBaseMapsGrid";
import SelectorBaseMapsImageMode from "Features/baseMaps/components/SelectorBaseMapsImageMode";
import ButtonFullScreen from "Features/layout/components/ButtonFullScreen";
import ButtonToggleThreedViewer from "Features/viewers/components/ButtonToggleThreedViewer";

import { BASE_MAPS_GRID_HOTKEY } from "../hooks/useOpenBaseMapsGridHotkey";
import { ZOOM_OUT_HOTKEY } from "Features/mapEditor/hooks/useZoomOutHotkey";
import isEditableTarget from "../utils/isEditableTarget";
import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";
import {
  setActiveBaseMapsGrid,
  clearActiveBaseMapsGrid,
} from "../services/baseMapsGridRegistry";
import selectBaseMapsGridPinned from "../utils/selectBaseMapsGridPinned";
import composeBaseMapsGridSheets from "../utils/composeBaseMapsGridSheets";
import resolveBaseMapImageDisplay from "Features/baseMaps/utils/resolveBaseMapImageDisplay";
import getAlignedSheetsLayout from "../utils/getAlignedSheetsLayout";
import flyCameraMatrix from "../utils/flyCameraMatrix";
import {
  editorToGridCamera,
  gridToEditorCamera,
  getEditorCameraForSheetRatio,
  getGridCameraFitBounds,
  getSheetsBounds,
} from "../utils/getAlignedCameraMatrices";

import {
  ADD_SHEET_ID,
  BASE_MAPS_GRID_PHASE,
  FADE_DURATION_MS,
  FIT_DURATION_MS,
  OPENED_SHEET_PADDING,
  TABS_HEIGHT,
  ZOOM_DURATION_MS,
} from "../constants/baseMapsGridConstants";

const FIT_ALL_PADDING = {
  top: TABS_HEIGHT + 48,
  right: 64,
  bottom: 80,
  left: 64,
};

// The base maps of a listing laid like sheets of paper on a table, with their
// annotations (same context as the map editor underneath). Covers the map
// editor it is mounted in — SAME screen rect, so a sheet can be handed over
// between the editor camera and the grid camera without moving on screen:
// - opening: the editor zoomed out on the main base map (useOpenBaseMapsGrid),
//   the grid mounts aligned on it with that sheet only, then fades the table,
//   the other sheets and the tabs in;
// - closing: the table and the other sheets fade out, the grid camera zooms
//   on the opened sheet, then the editor (already showing that base map
//   underneath) takes over with the equivalent camera.
// SCOPE module (selectBaseMapsGridPinned): the grid is the module's landing
// state — a click on a sheet only selects it (table highlight + BASE_MAP
// item of the properties panel), a double-click leaves the grid on that
// base map (regular closing transition); the sheets follow the content
// selection of the scope panel (no listing tabs) and draw the annotations
// of the listed listing. Leaving the grid (double-click, G, Escape, close
// button) drops `scopeGridWanted` so the keeper lets it closed.
export default function LayerBaseMapsGrid({ forViewerKey }) {
  const dispatch = useDispatch();

  // strings

  const closeS = "Fermer la grille";
  const fitAllS = "Tout afficher";
  const reorganizeS = "Réorganiser";
  const reorganizeDoneS = "Terminer la réorganisation";
  const alignS = "Aligner";
  const resetS = "Réinitialiser la disposition";

  // data

  const phase = useSelector((s) => s.baseMapsGrid.phase);
  const selectedListingId = useSelector(
    (s) => s.baseMapsGrid.selectedListingId
  );
  const selectedBaseMapId = useSelector(
    (s) => s.baseMapsGrid.selectedBaseMapId
  );
  const openFitAll = useSelector((s) => s.baseMapsGrid.openFitAll);
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const imageMode = useSelector((s) => s.viewers.baseMapsImageMode);
  const hideImageInViewer = useSelector(
    (s) => forViewerKey !== "BASE_MAPS" && s.viewers.hideBaseMapImageInViewer
  );
  const editorImageOpacity = useSelector((s) => s.mapEditor.baseMapOpacity);
  const editorGrayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);

  const panelKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const pinned = useSelector(selectBaseMapsGridPinned);
  // SCOPE module: no listing tabs — the sheets follow the content selection
  // of the scope panel (baseMapsGrid.scopeSheets, ScopeGridSheetsController),
  // whose listing narrows the annotations drawn on them.
  const scopeFilter = useScopeGridAnnotationsFilter();
  const scopeSheets = useSelector((s) => s.baseMapsGrid.scopeSheets);
  // per-sheet eye / badge of the "Fonds de plan" rows (pinned grid)
  const hiddenImageIds = useSelector((s) => s.baseMapsGrid.hiddenImageBaseMapIds);
  const hiddenAnnotationsIds = useSelector(
    (s) => s.baseMapsGrid.hiddenAnnotationsBaseMapIds
  );

  const listings = useProjectBaseMapListings({ excludeDisabled: true });
  const { value: baseMaps } = useBaseMaps();
  const spriteImage = useAnnotationSpriteImage();
  // same counts as the base map chips (whole scope, solo ignored)
  const annotationsCountByBaseMapId = useAnnotationsCountByBaseMapId();
  const selectMainBaseMap = useSelectMainBaseMap();
  const {
    positions,
    setSheetPosition,
    setSheetPositions,
    resetSheetPositions,
  } = useBaseMapsGridLayout();

  // state

  // aligned: the grid camera is posed (the layer stays hidden until then)
  const [aligned, setAligned] = useState(false);
  // revealed: table, tabs and the sheets other than the focused one are shown
  const [revealed, setRevealed] = useState(false);
  // sheet handed over by the editor (opening) or to it (closing)
  const [focusBaseMapId, setFocusBaseMapId] = useState(mainBaseMapId);

  // "Réorganiser" mode: the sheets lift off the table and can be dragged.
  // Off (default), a press on a sheet pans the table — no accidental move.
  const [reorganizing, setReorganizing] = useState(false);

  // refs

  const viewportRef = useRef(null);
  const alignedRef = useRef(false);
  const cancelFlightRef = useRef(null);
  const timeoutsRef = useRef([]);

  // helpers

  const isOpen = phase === BASE_MAPS_GRID_PHASE.OPEN;

  // image display: same global mode as the editor underneath (FULL = as is)
  const {
    hideImage,
    opacity: imageOpacity,
    grayScale,
  } = resolveBaseMapImageDisplay({
    imageMode,
    hideImage: hideImageInViewer,
    opacity: editorImageOpacity,
    grayScale: editorGrayScale,
  });
  const rightOffset = panelKey ? panelWidth + 24 : 24;

  // Displayed table: a listing tab, or (pinned) the scope selection.
  const tabListingId = listings?.some((l) => l.id === selectedListingId)
    ? selectedListingId
    : (listings?.[0]?.id ?? null);
  const listingId = pinned ? scopeSheets.addListingId : tabListingId;
  const scopeBaseMapIds = pinned ? scopeSheets.baseMapIds : null;
  const folderNameById = useMemo(() => {
    const map = {};
    listings?.forEach((l) => (map[l.id] = l.name));
    return map;
  }, [listings]);

  const countByListingId = useMemo(() => {
    const counts = {};
    baseMaps?.forEach((baseMap) => {
      counts[baseMap.listingId] = (counts[baseMap.listingId] ?? 0) + 1;
    });
    return counts;
  }, [baseMaps]);

  // helpers - sheets of the displayed listing

  const { items, addSheet } = useMemo(
    () =>
      composeBaseMapsGridSheets({
        baseMaps,
        listingId,
        baseMapIds: scopeBaseMapIds,
        positions,
      }),
    [baseMaps, listingId, scopeBaseMapIds, positions]
  );

  const sheetById = useMemo(() => {
    const map = {};
    items.forEach((item) => (map[item.sheet.id] = item.sheet));
    // part of the table: framed by "fit all"
    if (listingId) map[ADD_SHEET_ID] = addSheet;
    return map;
  }, [items, addSheet, listingId]);
  const sheetByIdRef = useRef(sheetById);
  sheetByIdRef.current = sheetById;
  // base map of each sheet (the Dessin navigation of the pinned grid)
  const baseMapByIdRef = useRef({});
  baseMapByIdRef.current = useMemo(() => {
    const map = {};
    items.forEach((item) => (map[item.baseMap.id] = item.baseMap));
    return map;
  }, [items]);

  const baseMapIds = useMemo(() => items.map((item) => item.sheet.id), [items]);
  const hasManualPositions = baseMapIds.some((id) => positions[id]);
  const annotationsByBaseMapId = useBaseMapsGridAnnotations({
    baseMapIds,
    forViewerKey,
    filterByListingId: pinned ? scopeFilter.filterByListingId : undefined,
    annotationIdSet: pinned ? scopeFilter.annotationIdSet : null,
  });
  const scopeFilterActive = pinned && scopeFilter.active;

  // selected sheet drawn last, on top of the others
  const orderedItems = useMemo(() => {
    if (!selectedBaseMapId) return items;
    return [...items].sort(
      (a, b) =>
        (a.sheet.id === selectedBaseMapId) - (b.sheet.id === selectedBaseMapId)
    );
  }, [items, selectedBaseMapId]);

  // helpers - timers & flights

  const later = useCallback((fn, delayMs) => {
    const id = setTimeout(fn, delayMs);
    timeoutsRef.current.push(id);
  }, []);

  useEffect(
    () => () => {
      cancelFlightRef.current?.();
      timeoutsRef.current.forEach(clearTimeout);
    },
    []
  );

  const getZoom = useCallback(() => viewportRef.current?.getZoom?.() ?? 1, []);

  const flyGridCamera = useCallback((to, durationMs, onDone) => {
    const viewport = viewportRef.current;
    if (!viewport || !to) {
      onDone?.();
      return;
    }
    const size = viewport.getViewportSize();
    cancelFlightRef.current?.();
    cancelFlightRef.current = flyCameraMatrix({
      from: viewport.getCameraMatrix(),
      to,
      center: { x: size.width / 2, y: size.height / 2 },
      durationMs,
      onTick: (matrix) => viewport.setCameraMatrix(matrix),
      onDone,
    });
  }, []);

  const getFitAllCamera = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return null;
    return getGridCameraFitBounds({
      bounds: getSheetsBounds(Object.values(sheetByIdRef.current)),
      viewport: viewport.getViewportSize(),
      // no tabs band on the pinned table
      padding: pinned
        ? { ...FIT_ALL_PADDING, top: FIT_ALL_PADDING.top - TABS_HEIGHT }
        : FIT_ALL_PADDING,
    });
  }, [pinned]);

  // effect - opening: pose the grid camera on the editor's one, then reveal

  useLayoutEffect(() => {
    if (alignedRef.current) return;
    if (!baseMaps || !listings) return; // still loading
    if (pinned && !scopeSheets.ready) return; // sheets not resolved yet
    const viewport = viewportRef.current;
    if (!viewport) return;
    alignedRef.current = true;

    const focusSheet = sheetById[mainBaseMapId];
    const editorCamera = getActiveMapEditor()?.getCameraMatrix?.();
    const camera =
      focusSheet && editorCamera
        ? editorToGridCamera({ editorCamera, sheet: focusSheet })
        : getFitAllCamera();
    if (camera) viewport.setCameraMatrix(camera);

    setFocusBaseMapId(focusSheet ? mainBaseMapId : null);
    setAligned(true);
    // reveal once the aligned frame is painted, so the fade starts from it
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setRevealed(true);
        // "fit all" opening: from the aligned frame, fly to the whole table
        // while the other sheets fade in
        if (openFitAll) {
          dispatch(setBaseMapsGridOpenFitAll(false));
          flyGridCamera(getFitAllCamera(), FIT_DURATION_MS);
        }
      })
    );
    later(
      () => dispatch(setBaseMapsGridPhase(BASE_MAPS_GRID_PHASE.OPEN)),
      FADE_DURATION_MS + 50
    );
  }, [
    baseMaps,
    listings,
    sheetById,
    mainBaseMapId,
    getFitAllCamera,
    flyGridCamera,
    later,
    dispatch,
    pinned,
    scopeSheets.ready,
    openFitAll,
  ]);

  // effect - the editor camera equivalent to the grid camera, for the 2D ->
  // 3D toggle of the pinned grid (useToggleModuleEditor): the editor camera
  // was parked at the opening, the grid camera is the one the user moved.

  useEffect(() => {
    const handle = {
      getEditorCameraFromGrid: () => {
        const viewport = viewportRef.current;
        const sheet = sheetByIdRef.current[mainBaseMapId];
        if (!viewport || !sheet) return null;
        return gridToEditorCamera({
          gridCamera: viewport.getCameraMatrix(),
          sheet,
        });
      },
    };
    setActiveBaseMapsGrid(handle);
    return () => clearActiveBaseMapsGrid(handle);
  }, [mainBaseMapId]);

  // effect - tab change: frame the sheets of the new table

  // Pinned: the table changes with the content selection instead (same
  // re-framing when the sheet set changes).
  const tableKey = pinned ? scopeSheets.baseMapIds.join(",") : listingId;
  const framedTableKeyRef = useRef(null);
  useEffect(() => {
    if (!isOpen || !tableKey) return;
    const previous = framedTableKeyRef.current;
    framedTableKeyRef.current = tableKey;
    if (!previous || previous === tableKey) return;
    flyGridCamera(getFitAllCamera(), FIT_DURATION_MS);
  }, [isOpen, tableKey, flyGridCamera, getFitAllCamera]);

  // handlers

  const handleSelect = useCallback(
    (baseMapId) => dispatch(setBaseMapsGridSelectedBaseMapId(baseMapId)),
    [dispatch]
  );

  const handleMove = useCallback(
    (baseMapId, position) => {
      setSheetPosition(baseMapId, position);
      dispatch(setBaseMapsGridSelectedBaseMapId(baseMapId));
    },
    [setSheetPosition, dispatch]
  );

  const handleOpen = useCallback(
    (baseMapId) => {
      if (!isOpen) return;
      const sheet = sheetByIdRef.current[baseMapId];
      const hasSheet = Boolean(sheet);
      // SCOPE module: the user leaves the grid — the keeper must not re-open
      // it when the CLOSED phase lands (set before the transition).
      if (pinned) dispatch(setScopeGridWanted(false));

      const finish = (editorCamera) => {
        const mapEditor = getActiveMapEditor();
        if (editorCamera) {
          mapEditor?.setCameraMatrix?.(editorCamera);
          // The editor re-fits its camera when its base map changes: re-apply
          // once it has settled.
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              getActiveMapEditor()?.setCameraMatrix?.(editorCamera)
            )
          );
        }
        dispatch(setBaseMapsGridPhase(BASE_MAPS_GRID_PHASE.CLOSED));
      };

      setReorganizing(false);
      setFocusBaseMapId(hasSheet ? baseMapId : null);
      setRevealed(false);
      dispatch(setBaseMapsGridPhase(BASE_MAPS_GRID_PHASE.CLOSING_FADE));
      // The editor loads the base map under the (opaque) grid meanwhile.
      if (hasSheet) selectMainBaseMap(baseMapId);

      later(() => {
        const sheet = sheetByIdRef.current[baseMapId];
        const viewport = viewportRef.current;
        const size = viewport?.getViewportSize?.();
        const fitted =
          sheet &&
          size &&
          getEditorCameraForSheetRatio({
            printZone: sheet.printZone,
            viewport: {
              width: size.width - 2 * OPENED_SHEET_PADDING,
              height: size.height - 2 * OPENED_SHEET_PADDING,
            },
            ratio: 1,
          });
        if (!fitted) {
          finish(null);
          return;
        }
        const editorCamera = {
          k: fitted.k,
          x: size.width / 2,
          y: size.height / 2,
        };
        dispatch(setBaseMapsGridPhase(BASE_MAPS_GRID_PHASE.CLOSING_ZOOM));
        flyGridCamera(
          editorToGridCamera({ editorCamera, sheet }),
          ZOOM_DURATION_MS,
          () => finish(editorCamera)
        );
      }, FADE_DURATION_MS);
    },
    [isOpen, dispatch, selectMainBaseMap, later, flyGridCamera, pinned]
  );

  function handleClose() {
    handleOpen(selectedBaseMapId ?? mainBaseMapId);
  }

  // Drops the hand-made arrangement of the displayed table: the sheets go
  // back to their default slots.
  function handleReset() {
    resetSheetPositions(baseMapIds);
    later(() => flyGridCamera(getFitAllCamera(), FIT_DURATION_MS), 0);
  }

  function handleFitAll() {
    flyGridCamera(getFitAllCamera(), FIT_DURATION_MS);
  }

  function handleToggleReorganize() {
    setReorganizing((value) => !value);
  }

  // Tidies the hand-made arrangement (same rows, same order, aligned tops,
  // constant gaps).
  function handleAlign() {
    setSheetPositions(
      getAlignedSheetsLayout({ sheets: items.map((item) => item.sheet) })
    );
    // frame the table once the sheets are on their aligned slots
    later(() => flyGridCamera(getFitAllCamera(), FIT_DURATION_MS), 0);
  }

  function handleListingChange(id) {
    dispatch(setBaseMapsGridListingId(id));
    dispatch(setBaseMapsGridSelectedBaseMapId(null));
  }

  function handleAddBaseMap() {
    // the new base map lands in the listing of the displayed table
    dispatch(setSelectedBaseMapsListingId(listingId));
    dispatch(setShowCreateBaseMapSection(true));
  }

  // Clean click (not a pan) anywhere on the table. Outside the "Réorganiser"
  // mode a press on a sheet pans the table like a press on the table itself,
  // so its click lands here: it opens the sheet (SCOPE module: selects it).
  // A click on the table itself clears the selection.
  const lastCleanClickRef = useRef(null);
  function handleTableClick({ event }) {
    if (!isOpen) return;
    const sheetId =
      event?.target?.closest?.("[data-sheet-id]")?.dataset?.sheetId ?? null;
    lastCleanClickRef.current = sheetId ? { sheetId, at: Date.now() } : null;
    if (sheetId === ADD_SHEET_ID) {
      handleAddBaseMap();
      return;
    }
    if (sheetId) {
      if (pinned) {
        // selected on the table AND as the item of the properties panel
        dispatch(setBaseMapsGridSelectedBaseMapId(sheetId));
        const baseMap = baseMapByIdRef.current[sheetId];
        if (baseMap) {
          dispatch(
            setSelectedItem({
              id: baseMap.id,
              type: "BASE_MAP",
              listingId: baseMap.listingId,
            })
          );
        }
      } else handleOpen(sheetId);
      return;
    }
    dispatch(setBaseMapsGridSelectedBaseMapId(null));
    if (pinned) dispatch(setSelectedItem(null));
  }

  // SCOPE module: a double-click on a sheet leaves the grid on that base
  // map (the regular closing transition). The viewport has no double-click
  // of its own: it reports the two clean clicks (above), then the native
  // dblclick bubbles here — honoured only when the second click was a clean
  // click on that same sheet (a press that panned the table in between is
  // not a double-click).
  function handleTableDoubleClick(event) {
    if (!pinned || !isOpen || reorganizing) return;
    const sheetId =
      event.target?.closest?.("[data-sheet-id]")?.dataset?.sheetId ?? null;
    if (!sheetId || sheetId === ADD_SHEET_ID) return;
    const last = lastCleanClickRef.current;
    if (last?.sheetId !== sheetId || Date.now() - last.at > 500) return;
    lastCleanClickRef.current = null;
    handleOpen(sheetId);
  }

  // effect - Escape / "G" close the grid, "Z" fits all the sheets

  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;
  const handleFitAllRef = useRef(handleFitAll);
  handleFitAllRef.current = handleFitAll;
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() === BASE_MAPS_GRID_HOTKEY.toLowerCase()) {
        handleCloseRef.current();
        return;
      }
      if (e.key.toLowerCase() === ZOOM_OUT_HOTKEY.toLowerCase()) {
        if (e.repeat) return;
        handleFitAllRef.current();
        return;
      }
      if (e.key !== "Escape") return;
      // Escape leaves the "Réorganiser" mode first, then the grid
      if (reorganizing) setReorganizing(false);
      else handleCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, reorganizing]);

  // render

  const fade = `opacity ${FADE_DURATION_MS}ms ease`;

  return (
    <Box
      data-capture-hide
      sx={{
        position: "absolute",
        inset: 0,
        // over the editor chrome (UILayer), under PopperMapListings (10)
        zIndex: 5,
        overflow: "hidden",
        // The table IS the editor background: opaque, so the editor can
        // re-frame underneath.
        bgcolor: "background.default",
        visibility: aligned ? "visible" : "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onDoubleClick={handleTableDoubleClick}
      >
        <MapEditorViewport
          ref={viewportRef}
          shouldDisablePan={(e) =>
            !isOpen || Boolean(e.target?.closest?.("[data-sheet-movable]"))
          }
          onWorldClick={handleTableClick}
        >
          <defs>
            <filter
              id={SHEET_SHADOW_FILTER_ID}
              x="-10%"
              y="-10%"
              width="120%"
              height="125%"
            >
              <feDropShadow
                dx="0"
                dy="6"
                stdDeviation="10"
                floodColor="#000"
                floodOpacity="0.28"
              />
            </filter>
            <filter
              id={SHEET_LIFTED_SHADOW_FILTER_ID}
              x="-15%"
              y="-15%"
              width="130%"
              height="145%"
            >
              <feDropShadow
                dx="0"
                dy="22"
                stdDeviation="26"
                floodColor="#000"
                floodOpacity="0.38"
              />
            </filter>
          </defs>

          {orderedItems.map(({ baseMap, sheet }) => {
            const isFocus = baseMap.id === focusBaseMapId;
            return (
              <BaseMapSheetSvg
                key={baseMap.id}
                baseMap={baseMap}
                sheet={sheet}
                annotations={
                  pinned && hiddenAnnotationsIds.includes(baseMap.id)
                    ? undefined
                    : annotationsByBaseMapId[baseMap.id]
                }
                // pinned, across folders: the folder under the name
                subtitle={
                  pinned && !listingId
                    ? folderNameById[baseMap.listingId]
                    : undefined
                }
                annotationsCount={
                  scopeFilterActive
                    ? (annotationsByBaseMapId[baseMap.id]?.length ?? 0)
                    : (annotationsCountByBaseMapId[baseMap.id] ?? 0)
                }
                spriteImage={spriteImage}
                selected={baseMap.id === selectedBaseMapId}
                visible={revealed || isFocus}
                chromeVisible={revealed}
                hideImage={
                  hideImage || (pinned && hiddenImageIds.includes(baseMap.id))
                }
                imageOpacity={imageOpacity}
                grayScale={grayScale}
                disabled={!isOpen}
                movable={reorganizing}
                getZoom={getZoom}
                onSelect={handleSelect}
                onMove={handleMove}
              />
            );
          })}

          {listingId && (
            <AddBaseMapSheetSvg
              sheet={addSheet}
              visible={revealed}
              disabled={!isOpen}
            />
          )}
        </MapEditorViewport>
      </Box>

      <Box
        sx={{
          opacity: revealed ? 1 : 0,
          transition: fade,
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        {/* SCOPE module: no listing tabs, the scope content drives the
            table. */}
        {!pinned && (
          <BaseMapsGridTabs
            listings={listings}
            countByListingId={countByListingId}
            selectedListingId={listingId}
            onSelect={handleListingChange}
          />
        )}

        <Box
          sx={{
            position: "absolute",
            right: `${rightOffset}px`,
            top: "14px",
            display: "flex",
            alignItems: "center",
            gap: 1,
            transition: "right 0.2s ease",
          }}
        >
          <ButtonFullScreen />
          <SelectorBaseMapsImageMode />
          {reorganizing && (
            <ButtonBaseMapsGrid
              title={resetS}
              icon={<RestartAlt />}
              disabled={!hasManualPositions}
              onClick={handleReset}
            />
          )}
          {reorganizing && (
            <ButtonBaseMapsGrid
              title={alignS}
              icon={<AlignHorizontalLeft />}
              onClick={handleAlign}
            />
          )}
          <ButtonBaseMapsGrid
            title={reorganizing ? reorganizeDoneS : reorganizeS}
            icon={<OpenWith />}
            active={reorganizing}
            onClick={handleToggleReorganize}
          />
          <ButtonBaseMapsGrid
            title={fitAllS}
            icon={<ZoomOutMap />}
            shortcut={ZOOM_OUT_HOTKEY}
            onClick={handleFitAll}
          />
          <ButtonBaseMapsGrid
            title={closeS}
            icon={<GridView />}
            active
            shortcut={BASE_MAPS_GRID_HOTKEY}
            onClick={handleClose}
          />
        </Box>

        {/* SCOPE module: the 2D/3D toggle of the editor underneath (bottom
            right of UILayerDesktop) is covered by the opaque table — the
            grid shows its own, at the same place. */}
        {pinned && (
          <Box
            data-capture-hide
            sx={{
              position: "absolute",
              right: `${rightOffset - 8}px`,
              bottom: "16px",
              transition: "right 0.2s ease",
            }}
          >
            <ButtonToggleThreedViewer />
          </Box>
        )}
      </Box>
    </Box>
  );
}
