import { useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Raycaster, Vector2 } from "three";

import {
  setSelectedBaseMapsListingId,
  setShowCreateBaseMapSection,
} from "Features/mapEditor/mapEditorSlice";
import { setBaseMapsGridModeActive } from "Features/threedEditor/threedEditorSlice";
import {
  setBaseMapsGridSelectedBaseMapId,
  setScopeGridWanted,
  toggleBaseMapsGridImageHidden,
} from "Features/baseMapsGrid/baseMapsGridSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectMainBaseMap from "Features/threedEditor/hooks/useSelectMainBaseMap";
import selectBaseMapsGridPinned from "Features/baseMapsGrid/utils/selectBaseMapsGridPinned";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  getToggleBaseMapAnnotationsIn3dAction,
  getToggleBaseMapImageIn3dAction,
  isBaseMapAnnotationsOnIn3d,
  isBaseMapImageOnIn3d,
} from "../utils/baseMapImageEyeIn3d";

// Mirrors useDimensionPointerHandlers: past this distance a press-release is
// a camera drag, not a click.
const DRAG_THRESHOLD_PX = 4;
const TOOLTIP_OFFSET_PX = 15;

// Pointer of the 3D base maps grid (the regular hover / click / double-click
// handlers of MainThreedEditor bail while it is open):
//   - hover: orange outline around the sheet + its name in the tooltip
//   - click on the eye button (bottom-left): shows / hides the base map image
//     (same action as the image eye of the "Fonds de plan" rows)
//   - click on the annotations badge (Dessin module, right of the eye):
//     shows / hides the annotations of the base map (same action as the
//     badge of the "Fonds de plan" rows — on the table they show greyed
//     instead of leaving)
//   - click on the navigation button (bottom-right): leaves the grid around
//     this sheet — it stays where it is on screen, the other base maps fly
//     back to their real poses around it
//   - click on a sheet: closes the grid and opens that base map
//   - click on the "new base map" frame (or its "+ créer" button): opens the
//     create-base-map section for the listing of the table, the grid stays
//     open underneath (same as the "+" frame of the 2D grid)
// SCOPE module: a click on a sheet only SELECTS it (persistent outline,
// baseMapsGrid.selectedBaseMapId + BASE_MAP item of the properties panel —
// never a change of main base map, the anchor of the table), a double-click
// opens it like the click does elsewhere; leaving the grid (double-click,
// nav sprite) drops `scopeGridWanted` so the keeper lets it closed.
// The camera controls keep working (orbit / pan / zoom over the table): a
// press that travels further than DRAG_THRESHOLD_PX is a camera gesture, not
// a click.
export default function useBaseMapsGrid3dPointer({ tooltipApiRef }) {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const showImageS = "Afficher l'image dans la vue 3D";
  const hideImageS = "Masquer l'image dans la vue 3D";
  const showAnnotationsS = "Afficher les annotations";
  const hideAnnotationsS = "Masquer les annotations";
  const leaveAroundS = "Quitter la grille sur ce fond de plan";
  const addBaseMapS = "Nouveau fond de plan";

  // data

  const active = useSelector((s) => s.threedEditor.baseMapsGridMode.active);
  const pinned = useSelector(selectBaseMapsGridPinned);
  const selectMainBaseMap = useSelectMainBaseMap();
  // the listing of the table (the new base map lands in it)
  const mainBaseMap = useMainBaseMap();
  const scopeAddListingId = useSelector(
    (s) => s.baseMapsGrid.scopeSheets.addListingId
  );
  const listingId = pinned
    ? scopeAddListingId
    : (mainBaseMap?.listingId ?? null);
  const { value: baseMaps } = useBaseMaps();

  // refs

  const listingIdRef = useRef(listingId);
  listingIdRef.current = listingId;
  const baseMapsRef = useRef(baseMaps);
  baseMapsRef.current = baseMaps;

  useEffect(() => {
    if (!active) return undefined;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    const manager = sceneManager?.baseMapsGridManager;
    if (!dom || !manager) return undefined;

    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const tooltipApi = tooltipApiRef?.current;

    let downPos = null;
    let isDragging = false;
    let hoverRafId = null;
    let lastMoveEvent = null;
    const previousCursor = dom.style.cursor;

    function pick(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, sceneManager.camera);
      const hit = manager.pick(raycaster);
      return hit ? { ...hit, rect } : null;
    }

    function clearHover() {
      manager.setHovered(null);
      tooltipApi?.clear();
      dom.style.cursor = previousCursor;
    }

    function runHover() {
      hoverRafId = null;
      const e = lastMoveEvent;
      if (!e || !manager.isActive()) return;
      const hit = pick(e);
      if (!hit) {
        clearHover();
        return;
      }
      manager.setHovered(hit.baseMapId);
      dom.style.cursor = "pointer";
      let text = manager.getSheetName(hit.baseMapId);
      if (hit.kind === "add") {
        text = addBaseMapS;
      } else if (hit.kind === "nav") {
        text = leaveAroundS;
      } else if (hit.kind === "eye") {
        const state = store.getState();
        const imageOn = pinned
          ? !state.baseMapsGrid.hiddenImageBaseMapIds.includes(hit.baseMapId)
          : isBaseMapImageOnIn3d({
              threedEditor: state.threedEditor,
              mainBaseMapId: state.mapEditor.selectedBaseMapId,
              baseMapId: hit.baseMapId,
            });
        text = imageOn ? hideImageS : showImageS;
      } else if (hit.kind === "badge") {
        const state = store.getState();
        const annotationsOn = isBaseMapAnnotationsOnIn3d({
          threedEditor: state.threedEditor,
          mainBaseMapId: state.mapEditor.selectedBaseMapId,
          baseMapId: hit.baseMapId,
        });
        text = annotationsOn ? hideAnnotationsS : showAnnotationsS;
      }
      if (text) {
        tooltipApi?.setText(
          text,
          e.clientX - hit.rect.left + TOOLTIP_OFFSET_PX,
          e.clientY - hit.rect.top + TOOLTIP_OFFSET_PX
        );
      } else {
        tooltipApi?.clear();
      }
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      isDragging = false;
    }

    function onPointerMove(e) {
      if (downPos) {
        const dx = e.clientX - downPos.x;
        const dy = e.clientY - downPos.y;
        if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          isDragging = true;
        }
      }
      // no hover while a button is down (camera gesture)
      if (e.buttons) return;
      lastMoveEvent = e;
      if (hoverRafId === null) hoverRafId = requestAnimationFrame(runHover);
    }

    function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasClick = downPos && !isDragging;
      downPos = null;
      isDragging = false;
      if (!wasClick || !manager.isActive()) return;

      const hit = pick(e);
      if (!hit) {
        // SCOPE module: a click on the table itself clears the selection
        // (same as the 2D grid)
        if (pinned) {
          dispatch(setBaseMapsGridSelectedBaseMapId(null));
          dispatch(setSelectedItem(null));
        }
        return;
      }
      if (hit.kind === "add") {
        clearHover();
        dispatch(setSelectedBaseMapsListingId(listingIdRef.current));
        dispatch(setShowCreateBaseMapSection(true));
        return;
      }
      if (hit.kind === "eye") {
        // pinned: the grid's own eye (shared with the 2D grid and the
        // "Fonds de plan" rows), else the 3D eye of the base map
        dispatch(
          pinned
            ? toggleBaseMapsGridImageHidden(hit.baseMapId)
            : getToggleBaseMapImageIn3dAction({
                mainBaseMapId: store.getState().mapEditor.selectedBaseMapId,
                baseMapId: hit.baseMapId,
              })
        );
        return;
      }
      if (hit.kind === "badge") {
        const state = store.getState();
        dispatch(
          getToggleBaseMapAnnotationsIn3dAction({
            threedEditor: state.threedEditor,
            mainBaseMapId: state.mapEditor.selectedBaseMapId,
            baseMapId: hit.baseMapId,
          })
        );
        return;
      }
      if (hit.kind === "nav") {
        const state = store.getState();
        const args = {
          threedEditor: state.threedEditor,
          mainBaseMapId: state.mapEditor.selectedBaseMapId,
          baseMapId: hit.baseMapId,
        };
        // A sheet showing nothing would vanish once out of the grid: its
        // image is turned on.
        if (!isBaseMapImageOnIn3d(args) && !isBaseMapAnnotationsOnIn3d(args)) {
          dispatch(getToggleBaseMapImageIn3dAction(args));
        }
        clearHover();
        manager.closeAround(hit.baseMapId);
        if (pinned) dispatch(setScopeGridWanted(false));
        dispatch(setBaseMapsGridModeActive(false));
        return;
      }
      // sheet: shift stays reserved (multi-selection / lasso of the editor)
      if (e.shiftKey) return;
      if (pinned) {
        // selected on the table AND as the item of the properties panel
        dispatch(setBaseMapsGridSelectedBaseMapId(hit.baseMapId));
        const sheetBaseMap = baseMapsRef.current?.find(
          (b) => b.id === hit.baseMapId
        );
        if (sheetBaseMap) {
          dispatch(
            setSelectedItem({
              id: sheetBaseMap.id,
              type: "BASE_MAP",
              listingId: sheetBaseMap.listingId,
            })
          );
        }
        return;
      }
      openSheet(hit.baseMapId);
    }

    // Leaves the grid on a sheet: the base map becomes the main one, the
    // camera frames it at its real pose.
    function openSheet(baseMapId) {
      // The frame of the base map at its REAL pose, read before the grid
      // releases the sheet.
      const frame = manager.getHomeFrame(baseMapId);
      clearHover();
      manager.close({ instant: true });
      if (pinned) dispatch(setScopeGridWanted(false));
      dispatch(setBaseMapsGridModeActive(false));
      selectMainBaseMap(baseMapId);
      if (frame) editor.fitToBox3Facing?.(frame.box, frame.normal);
    }

    // SCOPE module: the double-click on a sheet opens it (the click only
    // selects it there).
    function onDoubleClick(e) {
      if (!pinned || isDragging || !manager.isActive()) return;
      const hit = pick(e);
      if (!hit || hit.kind !== "sheet") return;
      const state = store.getState();
      const args = {
        threedEditor: state.threedEditor,
        mainBaseMapId: state.mapEditor.selectedBaseMapId,
        baseMapId: hit.baseMapId,
      };
      // A sheet showing nothing would vanish once out of the grid: its
      // image is turned on.
      if (!isBaseMapImageOnIn3d(args) && !isBaseMapAnnotationsOnIn3d(args)) {
        dispatch(getToggleBaseMapImageIn3dAction(args));
      }
      openSheet(hit.baseMapId);
    }

    function onPointerLeave() {
      lastMoveEvent = null;
      clearHover();
    }

    function onPointerCancel() {
      downPos = null;
      isDragging = false;
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    dom.addEventListener("dblclick", onDoubleClick);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      dom.removeEventListener("dblclick", onDoubleClick);
      if (hoverRafId !== null) cancelAnimationFrame(hoverRafId);
      clearHover();
    };
  }, [active, pinned, dispatch, store, selectMainBaseMap, tooltipApiRef]);
}
