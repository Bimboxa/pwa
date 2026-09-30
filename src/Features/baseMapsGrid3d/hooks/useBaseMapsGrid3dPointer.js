import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Raycaster, Vector2 } from "three";

import {
  focusBaseMapsGridSheet,
  setBaseMapsGridModeActive,
} from "Features/threedEditor/threedEditorSlice";

import useSelectMainBaseMap from "Features/threedEditor/hooks/useSelectMainBaseMap";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { getToggleBaseMapImageIn3dAction } from "../utils/baseMapImageEyeIn3d";

// Mirrors useDimensionPointerHandlers: past this distance a press-release is
// a camera drag, not a click.
const DRAG_THRESHOLD_PX = 4;
const TOOLTIP_OFFSET_PX = 15;

// Pointer of the 3D base maps grid (the regular hover / click / double-click
// handlers of MainThreedEditor bail while it is open):
//   - hover: orange outline around the sheet + its name in the tooltip
//   - click on a sheet: the others are laid around it (camera untouched)
//   - click on the eye button: shows / hides the base map image (same
//     action as the layer icon of the base map chips)
//   - double-click on a sheet: closes the grid and opens that base map
// The camera controls keep working (orbit / pan / zoom over the table).
export default function useBaseMapsGrid3dPointer({ tooltipApiRef }) {
  const dispatch = useDispatch();
  const store = useStore();

  const active = useSelector((s) => s.threedEditor.baseMapsGridMode.active);
  const selectMainBaseMap = useSelectMainBaseMap();

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
      const name = manager.getSheetName(hit.baseMapId);
      if (name) {
        tooltipApi?.setText(
          name,
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
      if (!hit) return;
      if (hit.kind === "eye") {
        dispatch(
          getToggleBaseMapImageIn3dAction({
            mainBaseMapId: store.getState().mapEditor.selectedBaseMapId,
            baseMapId: hit.baseMapId,
          })
        );
        return;
      }
      dispatch(focusBaseMapsGridSheet(hit.baseMapId));
    }

    function onDoubleClick(e) {
      if (e.shiftKey || !manager.isActive()) return;
      const hit = pick(e);
      if (!hit || hit.kind !== "sheet") return;
      // The regular double-click handler of MainThreedEditor (React, at the
      // root) must not run on top of this one once the grid is closed.
      e.stopPropagation();
      // The frame of the base map at its REAL pose, read before the grid
      // releases the sheet.
      const frame = manager.getHomeFrame(hit.baseMapId);
      clearHover();
      manager.close({ instant: true });
      dispatch(setBaseMapsGridModeActive(false));
      selectMainBaseMap(hit.baseMapId);
      if (frame) editor.fitToBox3Facing?.(frame.box, frame.normal);
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
  }, [active, dispatch, store, selectMainBaseMap, tooltipApiRef]);
}
