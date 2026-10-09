import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";
import { Raycaster, Vector2, Vector3 } from "three";

import {
  appendToVertexOffsetValueBuffer,
  deleteLastVertexOffsetValueBuffer,
  setVertexOffsetArmed,
  setVertexOffsetModeActive,
  setVertexOffsetValue,
} from "Features/threedEditor/threedEditorSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  buildTransientFaceMesh,
  loadAnnotationSnapshot,
} from "Features/threedDrawing/services/buildTransientFaceMesh";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import buildDrawingVertexMarkers from "Features/threedDrawing/utils/buildDrawingVertexMarkers";
import getBaseMapNormalWorld from "Features/threedDrawing/utils/getBaseMapNormalWorld";
import {
  deepHide,
  deepShow,
} from "Features/threedDrawing/utils/deepVisibility";
import findNearestVertexInVerts from "Features/threedBaseMapMove/utils/findNearestVertexInVerts";
import findNearestEdgeSnap from "Features/threedDimensions/utils/findNearestEdgeSnap";
import getAxisDragValue from "Features/threedExtrude/utils/getAxisDragValue";
import parseExtrudeValueBuffer, {
  EXTRUDE_BUFFER_CHAR_RE,
} from "Features/threedExtrude/utils/parseExtrudeValueBuffer";

import commitPointOffsetService from "../services/commitPointOffsetService";
import {
  clearVertexOffsetOverlay,
  setVertexOffsetOverlay,
} from "../services/vertexOffsetOverlayStore";
import getFaceVertexHandles from "../utils/getFaceVertexHandles";
import getVertexOffsetFieldLabel from "../utils/getVertexOffsetFieldLabel";
import resolveVertexOffsetTarget from "../utils/resolveVertexOffsetTarget";

// Mirrors useExtrudePointerHandlers.
const DRAG_THRESHOLD_PX = 4;
const TRACKING_THRESHOLD_PX = 4;
// Screen distance under which a handle is hovered / the armed vertex levels
// on a scene vertex or edge — the vertex snap of the 3D drawing tools.
const SNAP_THRESHOLD_PX = 12;
// Handles are grabbed: bigger than the drawn-point markers.
const HANDLE_SIZE_PX = 14;
// Length (m) of the vertical helper on each side of the anchor.
const AXIS_HELPER_MIN_M = 2;
// A handle sits on the displayed conversion, 1 mm above a PX wall's real
// quad (the conversion strips a z-fight lift the wall never had): the anchor
// is the real scene vertex under the handle, so a snapped level is exact.
const ANCHOR_SNAP_M = 0.003;

// Handle colors: idle = the yellow of the selected vertex helper
// (subSelectionHelpers), hovered = its fluo green.
const HANDLE_COLOR = 0xffff00;
const HANDLE_HOVER_COLOR = 0x00ff00;

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

function roundCm(value) {
  return Math.round(value * 100) / 100;
}

// Snapped values are kept exact, to the precision offsets are stored with.
function roundTenthMm(value) {
  return Math.round(value * 1e4) / 1e4;
}

function disposeObject(obj) {
  if (!obj) return;
  obj.parent?.remove(obj);
  obj.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

// Pointer interactions of the vertex offset mode (« Déplacer » while a face
// of a regular annotation is selected). Owns the pointer while
// vertexOffsetMode.active (MainThreedEditor's hover / click paths
// short-circuit). SketchUp-like two-click flow:
//
// - idle: the vertices of the selected face are drawn as handles
//   (getFaceVertexHandles); the one under the cursor turns green.
// - click 1 on a handle: arms that vertex. The real object is hidden and
//   replaced by a transient ghost (buildTransientFaceMesh, SHARED_ONLY on
//   that point) rebuilt at every value change.
// - mouse move: the vertex follows the cursor along the base map normal. Its
//   level snaps on a scene vertex, else on a scene feature edge (the point
//   of the edge under the cursor), else getAxisDragValue. The cursor chip
//   shows the resulting ABSOLUTE offset of the point.
// - typing digits: captured straight from the keyboard into
//   `vertexOffsetMode.valueBuffer` (no focused field). A parsable buffer
//   wins over the mouse; Backspace erases it.
// - click 2 / Enter: commits `offsetTop` / `offsetBottom` on the point ref.
//   The ghost stays in place of the real mesh until the AnnotationsManager
//   has rebuilt it from the written data; the mode stays armed for the next
//   vertex (the face selection is re-located by useMesh3dPartsHighlight).
// - Escape: cancels the armed vertex AND leaves the mode (the face stays
//   selected); so does losing the face selection or the Dessin module.
export default function useVertexOffsetPointerHandlers() {
  const dispatch = useDispatch();
  const store = useStore();

  const active = useSelector((s) => s.threedEditor.vertexOffsetMode.active);
  const modeAnnotationId = useSelector(
    (s) => s.threedEditor.vertexOffsetMode.annotationId
  );
  const value = useSelector((s) => s.threedEditor.vertexOffsetMode.value);
  const valueBuffer = useSelector(
    (s) => s.threedEditor.vertexOffsetMode.valueBuffer
  );
  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  // The face the handles sit on follows the selection (a commit re-locates
  // the selected face on the rebuilt mesh).
  const selectionKey = useSelector((s) => {
    const item = s.selection.selectedItems[0];
    return `${item?.nodeId ?? ""}|${item?.partId ?? ""}|${(
      s.selection.selectedPartIds || []
    ).join(",")}`;
  });

  const effectiveValue = parseExtrudeValueBuffer(valueBuffer) ?? value;

  const valueRef = useRef(effectiveValue);
  useEffect(() => {
    valueRef.current = effectiveValue;
  }, [effectiveValue]);
  const valueBufferRef = useRef(valueBuffer);
  useEffect(() => {
    valueBufferRef.current = valueBuffer;
  }, [valueBuffer]);
  // Face currently addressed: { annotationId, faceIndex }.
  const targetRef = useRef(null);
  // Set by the main effect for the selection / typed-value effects.
  const rebuildHandlesRef = useRef(null);
  const rebuildGhostRef = useRef(null);
  const scheduleHoverRef = useRef(null);

  // MAP-module-only mode.
  useEffect(() => {
    if (active && moduleKey !== "MAP") {
      dispatch(setVertexOffsetModeActive(false));
    }
  }, [active, moduleKey, dispatch]);

  // The selected face is the target: gone (or another annotation) → leave.
  useEffect(() => {
    if (!active) {
      targetRef.current = null;
      return;
    }
    const target = resolveVertexOffsetTarget(
      store.getState(),
      getActiveThreedEditor()
    );
    if (!target || target.annotationId !== modeAnnotationId) {
      dispatch(setVertexOffsetModeActive(false));
      return;
    }
    targetRef.current = target;
    rebuildHandlesRef.current?.();
  }, [active, modeAnnotationId, selectionKey, store, dispatch]);

  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    const scene = sceneManager?.scene;
    const annotationsManager = sceneManager?.annotationsManager;
    if (!sceneManager || !dom || !scene) return;

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    let rafId = null;
    let lastEvent = null;
    let downPos = null;
    let dragging = false;
    let disposed = false;

    // Handles of the target face: [{ pointId, field, baseOffset, world }].
    let handles = [];
    let handleMarkers = null;
    let hoverMarker = null;
    let hovered = null;

    // Armed vertex (null until a handle is clicked):
    //   { annotationId, handle, snapshot, axis, anchor, object, parent,
    //     ghost, downPos, tracking, snapVerts, snapAdjacency, snap }
    let armed = null;
    let arming = false;

    // Committed annotation whose ghost still stands for the real object:
    // annotationId -> { ghost, object, source }.
    const pending = new Map();

    dom.style.cursor = "default";

    function render() {
      sceneManager.renderScene?.();
    }

    function scheduleHover() {
      if (rafId == null && lastEvent) rafId = requestAnimationFrame(runHover);
    }
    scheduleHoverRef.current = scheduleHover;

    function getRect() {
      const rect = dom.getBoundingClientRect();
      return rect.width && rect.height ? rect : null;
    }

    function setMouse(e, rect) {
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function toScreen(world, rect) {
      const p = world.clone().project(sceneManager.camera);
      if (p.z < -1 || p.z > 1) return null;
      return {
        x: ((p.x + 1) / 2) * rect.width,
        y: ((1 - p.y) / 2) * rect.height,
      };
    }

    // ----- handles -----

    function clearHandleMarkers() {
      disposeObject(handleMarkers);
      disposeObject(hoverMarker);
      handleMarkers = null;
      hoverMarker = null;
      hovered = null;
    }

    function rebuildHandles() {
      if (disposed) return;
      clearHandleMarkers();
      const target = targetRef.current;
      handles = target
        ? getFaceVertexHandles({
            editor,
            annotationId: target.annotationId,
            faceIndex: target.faceIndex,
          })
        : [];
      if (handles.length && !armed) {
        handleMarkers = buildDrawingVertexMarkers(
          handles.map((h) => h.world),
          HANDLE_COLOR,
          { size: HANDLE_SIZE_PX }
        );
        if (handleMarkers) {
          handleMarkers.userData.isHoverOverlay = true;
          scene.add(handleMarkers);
        }
      }
      render();
      scheduleHover();
    }
    rebuildHandlesRef.current = rebuildHandles;

    function findHandleAtCursor(rect) {
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      let best = null;
      let bestSq = SNAP_THRESHOLD_PX * SNAP_THRESHOLD_PX;
      const tmp = new Vector3();
      for (const handle of handles) {
        tmp.copy(handle.world).project(sceneManager.camera);
        if (tmp.z < -1 || tmp.z > 1) continue;
        const dx = tmp.x * halfW - mouse.x * halfW;
        const dy = tmp.y * halfH - mouse.y * halfH;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestSq) {
          bestSq = d2;
          best = handle;
        }
      }
      return best;
    }

    function setHovered(handle) {
      if (handle === hovered) return;
      disposeObject(hoverMarker);
      hoverMarker = null;
      hovered = handle;
      if (handle) {
        hoverMarker = buildDrawingVertexMarkers(
          [handle.world],
          HANDLE_HOVER_COLOR,
          { size: HANDLE_SIZE_PX }
        );
        if (hoverMarker) {
          hoverMarker.userData.isHoverOverlay = true;
          scene.add(hoverMarker);
        }
      }
      dom.style.cursor = handle ? "pointer" : "default";
      render();
    }

    // ----- ghost -----

    function disposeGhost() {
      if (!armed?.ghost) return;
      disposeObject(armed.ghost);
      armed.ghost = null;
    }

    function buildGhost(v) {
      const { handle, snapshot } = armed;
      return buildTransientFaceMesh({
        snapshot,
        sharedIds: new Set([handle.pointId]),
        deltaLocal: { x: 0, y: 0, z: 0 },
        mode: "SHARED_ONLY",
        fieldByPointId: new Map([
          [handle.pointId, handle.field === "offsetTop" ? "TOP" : "BOTTOM"],
        ]),
        shiftByPointId: new Map([[handle.pointId, v - handle.baseOffset]]),
      });
    }

    function rebuildGhost(v) {
      if (!armed) return;
      disposeGhost();
      const ghost = buildGhost(v);
      if (ghost && armed.parent) {
        armed.parent.add(ghost);
        armed.ghost = ghost;
      }
      render();
    }
    rebuildGhostRef.current = rebuildGhost;

    // ----- arm / cancel / commit -----

    async function arm(e, handle) {
      if (arming || armed) return;
      arming = true;
      try {
        const target = targetRef.current;
        if (!target) return;
        const annotationId = target.annotationId;
        const snapshot = await loadAnnotationSnapshot(annotationId);
        if (disposed || !snapshot) return;
        const object =
          annotationsManager?.annotationsObjectsMap?.[annotationId];
        if (!object?.parent) return;

        // Snap targets: every scene vertex / feature edge, the armed
        // annotation's own included — read BEFORE it is hidden.
        clearHandleMarkers();
        const index = buildIndex(scene);
        let anchor = handle.world.clone();
        let anchorD2 = ANCHOR_SNAP_M * ANCHOR_SNAP_M;
        for (const vert of index.verts) {
          if (vert.nodeId !== annotationId) continue;
          const d2 = vert.position.distanceToSquared(handle.world);
          if (d2 < anchorD2) {
            anchorD2 = d2;
            anchor = vert.position.clone();
          }
        }
        armed = {
          annotationId,
          handle,
          snapshot,
          axis: getBaseMapNormalWorld(object),
          anchor,
          object,
          parent: object.parent,
          ghost: null,
          downPos: { x: e.clientX, y: e.clientY },
          tracking: false,
          snapVerts: index.verts,
          snapAdjacency: index.adjacency,
          snap: null,
        };
        deepHide(object);
        dispatch(
          setVertexOffsetArmed({
            pointId: handle.pointId,
            field: handle.field,
            baseOffset: handle.baseOffset,
          })
        );
        valueRef.current = handle.baseOffset;
        rebuildGhost(handle.baseOffset);
        dom.style.cursor = "crosshair";
        scheduleHover();
      } catch (err) {
        console.error("[threedVertexOffset] arming failed", err);
      } finally {
        arming = false;
      }
    }

    // Restore the real mesh and drop the armed state. Never writes.
    function cancelArm() {
      if (!armed) return;
      disposeGhost();
      deepShow(armed.object);
      armed = null;
      dispatch(setVertexOffsetArmed(null));
      clearVertexOffsetOverlay();
      dom.style.cursor = "default";
      render();
    }

    function holdGhostUntilRebuilt() {
      const { annotationId, ghost, object } = armed;
      pending.set(annotationId, {
        ghost,
        object,
        source: annotationsManager.getAnnotationSource(annotationId),
      });
      armed = null;
      dispatch(setVertexOffsetArmed(null));
      clearVertexOffsetOverlay();
      dom.style.cursor = "default";
    }

    function releasePending(annotationId, { restore = false } = {}) {
      const entry = pending.get(annotationId);
      if (!entry) return;
      pending.delete(annotationId);
      disposeObject(entry.ghost);
      if (restore) {
        deepShow(
          annotationsManager?.annotationsObjectsMap?.[annotationId] ??
            entry.object
        );
      }
      render();
    }

    async function commit() {
      if (!armed) return;
      const { annotationId, handle } = armed;
      const v = roundTenthMm(valueRef.current ?? handle.baseOffset);
      const unchanged = Math.abs(v - handle.baseOffset) < 1e-9;
      if (unchanged || !armed.ghost || !annotationsManager) {
        cancelArm();
        rebuildHandles();
        return;
      }
      holdGhostUntilRebuilt();
      try {
        const written = await commitPointOffsetService({
          annotationId,
          pointId: handle.pointId,
          field: handle.field,
          value: v,
        });
        if (!written) throw new Error("point ref not found");
      } catch (err) {
        console.error("[threedVertexOffset] commit failed", err);
        releasePending(annotationId, { restore: true });
        rebuildHandles();
      }
    }

    // ----- armed tracking -----

    function updateArmedValue(e, rect) {
      if (valueBufferRef.current !== "") {
        armed.snap = null;
        return;
      }
      if (!armed.tracking) {
        const dx = Math.abs(e.clientX - armed.downPos.x);
        const dy = Math.abs(e.clientY - armed.downPos.y);
        if (dx <= TRACKING_THRESHOLD_PX && dy <= TRACKING_THRESHOLD_PX) return;
        armed.tracking = true;
      }
      setMouse(e, rect);
      const canvasSize = { width: rect.width, height: rect.height };
      const { anchor, axis, handle } = armed;

      let next;
      const vertex = findNearestVertexInVerts(
        armed.snapVerts,
        mouse,
        sceneManager.camera,
        canvasSize,
        SNAP_THRESHOLD_PX
      );
      const edge = vertex
        ? null
        : findNearestEdgeSnap(
            armed.snapAdjacency,
            mouse,
            sceneManager.camera,
            canvasSize,
            SNAP_THRESHOLD_PX
          );
      const snapPoint = vertex?.position ?? edge?.position ?? null;
      if (snapPoint) {
        next = roundTenthMm(
          handle.baseOffset + snapPoint.clone().sub(anchor).dot(axis)
        );
        armed.snap = {
          position: snapPoint,
          kind: vertex ? "VERTEX" : "EDGE",
          value: next,
        };
      } else {
        armed.snap = null;
        raycaster.setFromCamera(mouse, sceneManager.camera);
        const raw = getAxisDragValue({ ray: raycaster.ray, anchor, axis });
        if (raw == null) return; // axis-aligned view: keep the last value
        next = roundCm(handle.baseOffset + raw);
      }
      if (next === valueRef.current) return;
      valueRef.current = next;
      dispatch(setVertexOffsetValue(next));
      rebuildGhost(next);
    }

    function getSnapMarker(rect) {
      const snap = armed?.snap;
      if (!snap || Math.abs((valueRef.current ?? 0) - snap.value) > 1e-6)
        return null;
      const screen = toScreen(snap.position, rect);
      return screen ? { ...screen, kind: snap.kind } : null;
    }

    function getAxisLine(rect) {
      const { anchor, axis, handle } = armed;
      const span = Math.abs((valueRef.current ?? 0) - handle.baseOffset);
      const length = Math.max(AXIS_HELPER_MIN_M, span + 1);
      const from = toScreen(
        anchor.clone().addScaledVector(axis, -length),
        rect
      );
      const to = toScreen(anchor.clone().addScaledVector(axis, length), rect);
      return from && to ? { from, to } : null;
    }

    function runHover() {
      rafId = null;
      const e = lastEvent;
      if (!e) return;
      const rect = getRect();
      if (!rect) return;

      if (armed) {
        updateArmedValue(e, rect);
        const shown = roundCm(valueRef.current ?? 0);
        setVertexOffsetOverlay({
          cursor: {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            label: `${getVertexOffsetFieldLabel(armed.handle.field)} ${shown > 0 ? "+" : ""}${shown} m`,
          },
          snap: getSnapMarker(rect),
          axisLine: getAxisLine(rect),
        });
        return;
      }

      setMouse(e, rect);
      setHovered(findHandleAtCursor(rect));
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      dragging = false;
    }

    function onPointerMove(e) {
      lastEvent = e;
      if (rafId == null) rafId = requestAnimationFrame(runHover);
      if (!downPos) return;
      const dx = Math.abs(e.clientX - downPos.x);
      const dy = Math.abs(e.clientY - downPos.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) dragging = true;
    }

    function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = dragging;
      downPos = null;
      dragging = false;
      if (wasDrag) return; // camera orbit, not a click
      if (e.shiftKey) return;

      if (armed) {
        commit();
        return;
      }
      const rect = getRect();
      if (!rect) return;
      setMouse(e, rect);
      const handle = findHandleAtCursor(rect);
      if (handle) arm(e, handle);
    }

    function onPointerCancel() {
      downPos = null;
      dragging = false;
    }

    function onPointerLeave() {
      lastEvent = null;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (!armed) setHovered(null);
    }

    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (armed) cancelArm();
        dispatch(setVertexOffsetModeActive(false));
        return;
      }
      if (e.key === "Enter") {
        if (armed) commit();
        return;
      }
      if (isEditableTarget(e.target)) return;
      if (!armed) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        if (valueBufferRef.current !== "")
          dispatch(deleteLastVertexOffsetValueBuffer());
        return;
      }
      if (EXTRUDE_BUFFER_CHAR_RE.test(e.key)) {
        if (e.key === "-" && valueBufferRef.current !== "") return;
        e.preventDefault();
        e.stopPropagation();
        dispatch(appendToVertexOffsetValueBuffer(e.key === "," ? "." : e.key));
      }
    }

    // Rebuilds of the annotation object: the one carrying the committed
    // write releases the ghost; any other (same source) keeps it hidden
    // behind the ghost. The handles follow the fresh geometry.
    const unsubReady = annotationsManager?.subscribeAnnotationReady?.((ids) => {
      const objects = annotationsManager.annotationsObjectsMap;
      let touched = false;
      for (const id of ids) {
        const entry = pending.get(id);
        if (entry) {
          if (annotationsManager.getAnnotationSource(id) !== entry.source) {
            releasePending(id);
          } else if (objects?.[id]) {
            entry.object = objects[id];
            deepHide(entry.object);
          }
        }
        if (id === targetRef.current?.annotationId) touched = true;
      }
      if (armed && ids.includes(armed.annotationId)) {
        const live = objects?.[armed.annotationId];
        if (live) {
          armed.object = live;
          armed.parent = live.parent || armed.parent;
          deepHide(live);
          rebuildGhost(valueRef.current);
        }
        return;
      }
      if (touched) rebuildHandles();
    });

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    // Capture phase: the typed digits / Backspace / Escape must reach this
    // mode before the window-scoped shortcuts of the other features.
    window.addEventListener("keydown", onKeyDown, true);

    rebuildHandles();

    return () => {
      disposed = true;
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown, true);
      unsubReady?.();
      rebuildHandlesRef.current = null;
      rebuildGhostRef.current = null;
      scheduleHoverRef.current = null;
      if (rafId != null) cancelAnimationFrame(rafId);
      cancelArm();
      for (const id of [...pending.keys()]) {
        releasePending(id, { restore: true });
      }
      clearHandleMarkers();
      clearVertexOffsetOverlay();
      dom.style.cursor = "";
      render();
    };
  }, [active, dispatch]);

  // Typed value → refresh the ghost and the cursor chip (no pointer move
  // needed), plus the one tick where the buffer is emptied.
  const prevValueBufferRef = useRef(valueBuffer);
  useEffect(() => {
    const prev = prevValueBufferRef.current;
    prevValueBufferRef.current = valueBuffer;
    if (!active) return;
    if (valueBuffer === "" && prev === "") return;
    rebuildGhostRef.current?.(effectiveValue);
    scheduleHoverRef.current?.();
  }, [active, valueBuffer, effectiveValue]);
}
