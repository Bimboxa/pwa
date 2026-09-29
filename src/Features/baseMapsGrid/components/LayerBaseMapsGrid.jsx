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
} from "../baseMapsGridSlice";
import {
  setSelectedBaseMapsListingId,
  setShowCreateBaseMapSection,
} from "Features/mapEditor/mapEditorSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationsCountByBaseMapId from "Features/annotations/hooks/useAnnotationsCountByBaseMapId";
import useSelectMainBaseMap from "Features/threedEditor/hooks/useSelectMainBaseMap";
import useBaseMapsGridAnnotations from "../hooks/useBaseMapsGridAnnotations";
import useBaseMapsGridLayout from "../hooks/useBaseMapsGridLayout";

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
import SelectorBaseMapsGridImageMode from "./SelectorBaseMapsGridImageMode";

import { BASE_MAPS_GRID_HOTKEY } from "../hooks/useOpenBaseMapsGridHotkey";
import isEditableTarget from "../utils/isEditableTarget";
import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";
import getBaseMapSheet from "../utils/getBaseMapSheet";
import getBaseMapsGridAutoLayout, {
  BASE_MAPS_GRID_GAP,
} from "../utils/getBaseMapsGridAutoLayout";
import getAlignedSheetsLayout, {
  getSheetsRows,
} from "../utils/getAlignedSheetsLayout";
import flyCameraMatrix from "../utils/flyCameraMatrix";
import {
  editorToGridCamera,
  getEditorCameraForSheetRatio,
  getGridCameraFitBounds,
  getSheetsBounds,
} from "../utils/getAlignedCameraMatrices";

import {
  ADD_SHEET_ID,
  ADD_SHEET_SIZE,
  BASE_MAPS_GRID_IMAGE_MODE,
  BASE_MAPS_GRID_PHASE,
  FADED_IMAGE_OPACITY,
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
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const imageMode = useSelector((s) => s.baseMapsGrid.imageMode);
  const hideImageInViewer = useSelector(
    (s) => forViewerKey !== "BASE_MAPS" && s.viewers.hideBaseMapImageInViewer
  );
  const editorImageOpacity = useSelector((s) => s.mapEditor.baseMapOpacity);
  const editorGrayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);

  const panelKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const panelWidth = useSelector((s) => s.rightPanel.width);

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

  // image display: FULL = as in the editor underneath
  const isFaded = imageMode === BASE_MAPS_GRID_IMAGE_MODE.FADED;
  const hideImage =
    hideImageInViewer || imageMode === BASE_MAPS_GRID_IMAGE_MODE.NONE;
  const imageOpacity = isFaded ? FADED_IMAGE_OPACITY : editorImageOpacity;
  const grayScale = isFaded || editorGrayScale;
  const rightOffset = panelKey ? panelWidth + 16 : 16;

  const listingId = listings?.some((l) => l.id === selectedListingId)
    ? selectedListingId
    : listings?.[0]?.id ?? null;

  const countByListingId = useMemo(() => {
    const counts = {};
    baseMaps?.forEach((baseMap) => {
      counts[baseMap.listingId] = (counts[baseMap.listingId] ?? 0) + 1;
    });
    return counts;
  }, [baseMaps]);

  // helpers - sheets of the displayed listing

  const { items, addSheet } = useMemo(() => {
    const listingBaseMaps =
      baseMaps?.filter((baseMap) => baseMap.listingId === listingId) ?? [];
    const sized = listingBaseMaps
      .map((baseMap) => ({ baseMap, sheet: getBaseMapSheet({ baseMap }) }))
      .filter((item) => item.sheet);
    // The "+" frame takes the slot after the last sheet (bottom-right of
    // the grid).
    const autoPositions = getBaseMapsGridAutoLayout({
      sheets: [
        ...sized.map((item) => item.sheet),
        { id: ADD_SHEET_ID, ...ADD_SHEET_SIZE },
      ],
    });
    const items = sized.map(({ baseMap, sheet }) => {
      const position = positions[baseMap.id] ?? autoPositions[baseMap.id];
      return { baseMap, sheet: { ...sheet, x: position.x, y: position.y } };
    });

    // Hand-made arrangement: the default slot could lie under a moved
    // sheet, the frame goes at the end of the last row instead.
    let addPosition = autoPositions[ADD_SHEET_ID];
    if (sized.some(({ baseMap }) => positions[baseMap.id])) {
      const lastRow = getSheetsRows(items.map((item) => item.sheet)).at(-1);
      addPosition = {
        x:
          Math.max(...lastRow.map((s) => s.x + s.width)) + BASE_MAPS_GRID_GAP,
        y: Math.min(...lastRow.map((s) => s.y)),
      };
    }

    return {
      items,
      addSheet: { id: ADD_SHEET_ID, ...ADD_SHEET_SIZE, ...addPosition },
    };
  }, [baseMaps, listingId, positions]);

  const sheetById = useMemo(() => {
    const map = {};
    items.forEach((item) => (map[item.sheet.id] = item.sheet));
    // part of the table: framed by "fit all"
    if (listingId) map[ADD_SHEET_ID] = addSheet;
    return map;
  }, [items, addSheet, listingId]);
  const sheetByIdRef = useRef(sheetById);
  sheetByIdRef.current = sheetById;

  const baseMapIds = useMemo(() => items.map((item) => item.sheet.id), [items]);
  const hasManualPositions = baseMapIds.some((id) => positions[id]);
  const annotationsByBaseMapId = useBaseMapsGridAnnotations({
    baseMapIds,
    forViewerKey,
  });

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
      padding: FIT_ALL_PADDING,
    });
  }, []);

  // effect - opening: pose the grid camera on the editor's one, then reveal

  useLayoutEffect(() => {
    if (alignedRef.current) return;
    if (!baseMaps || !listings) return; // still loading
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
      requestAnimationFrame(() => setRevealed(true))
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
    later,
    dispatch,
  ]);

  // effect - tab change: frame the sheets of the new table

  const framedListingIdRef = useRef(null);
  useEffect(() => {
    if (!isOpen || !listingId) return;
    const previous = framedListingIdRef.current;
    framedListingIdRef.current = listingId;
    if (!previous || previous === listingId) return;
    flyGridCamera(getFitAllCamera(), FIT_DURATION_MS);
  }, [isOpen, listingId, flyGridCamera, getFitAllCamera]);

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
      const hasSheet = Boolean(sheetByIdRef.current[baseMapId]);

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
    [isOpen, dispatch, selectMainBaseMap, later, flyGridCamera]
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
  // so its click lands here.
  function handleTableClick({ event }) {
    if (!isOpen) return;
    const sheetId =
      event?.target?.closest?.("[data-sheet-id]")?.dataset?.sheetId ?? null;
    if (sheetId === ADD_SHEET_ID) {
      handleAddBaseMap();
      return;
    }
    dispatch(setBaseMapsGridSelectedBaseMapId(sheetId));
  }

  // effect - Escape / "G" close the grid

  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() === BASE_MAPS_GRID_HOTKEY.toLowerCase()) {
        handleCloseRef.current();
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
                annotations={annotationsByBaseMapId[baseMap.id]}
                annotationsCount={annotationsCountByBaseMapId[baseMap.id] ?? 0}
                spriteImage={spriteImage}
                selected={baseMap.id === selectedBaseMapId}
                visible={revealed || isFocus}
                chromeVisible={revealed}
                hideImage={hideImage}
                imageOpacity={imageOpacity}
                grayScale={grayScale}
                disabled={!isOpen}
                movable={reorganizing}
                getZoom={getZoom}
                onSelect={handleSelect}
                onOpen={handleOpen}
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
        <BaseMapsGridTabs
          listings={listings}
          countByListingId={countByListingId}
          selectedListingId={listingId}
          onSelect={handleListingChange}
        />

        <Box
          sx={{
            position: "absolute",
            right: `${rightOffset}px`,
            top: "7px",
            display: "flex",
            alignItems: "center",
            gap: 1,
            transition: "right 0.2s ease",
          }}
        >
          <SelectorBaseMapsGridImageMode />
          {reorganizing && (
            <ButtonBaseMapsGrid
              title={resetS}
              icon={<RestartAlt fontSize="small" />}
              disabled={!hasManualPositions}
              onClick={handleReset}
            />
          )}
          {reorganizing && (
            <ButtonBaseMapsGrid
              title={alignS}
              icon={<AlignHorizontalLeft fontSize="small" />}
              onClick={handleAlign}
            />
          )}
          <ButtonBaseMapsGrid
            title={reorganizing ? reorganizeDoneS : reorganizeS}
            icon={<OpenWith fontSize="small" />}
            active={reorganizing}
            onClick={handleToggleReorganize}
          />
          <ButtonBaseMapsGrid
            title={fitAllS}
            icon={<ZoomOutMap fontSize="small" />}
            onClick={handleFitAll}
          />
          <ButtonBaseMapsGrid
            title={closeS}
            icon={<GridView fontSize="small" />}
            active
            shortcut={BASE_MAPS_GRID_HOTKEY}
            onClick={handleClose}
          />
        </Box>
      </Box>
    </Box>
  );
}
