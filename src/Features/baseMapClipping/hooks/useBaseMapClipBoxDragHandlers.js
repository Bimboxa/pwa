import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import { Raycaster, Vector2 } from "three";

import store from "App/store";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import findNearestVertexInVerts from "Features/threedBaseMapMove/utils/findNearestVertexInVerts";
import {
  clearRevolutionAxisCutOverlay,
  setRevolutionAxisCutOverlay,
} from "Features/revolutionAxes/services/revolutionAxisCutsStore";

import { getBaseMapClipBoxFaces } from "../services/baseMapClipBoxStore";
import setBaseMapClipDepthService from "../services/setBaseMapClipDepthService";

const DRAG_THRESHOLD_PX = 3;
// A scene vertex this close to the cursor (screen px) gives its depth.
const SNAP_THRESHOLD_PX = 12;

const roundMm = (v) => Math.round(v * 1e3) / 1e3;

/**
 * Drag of a handle of the clip box of a base map in the 3D editor (built by
 * ThreedBaseMapClipBoxes): the face slides along the normal of the base map
 * under the cursor — `frontM` / `backM` of baseMap.clipping3d, never across
 * the base map itself. A scene vertex near the cursor wins: the face takes
 * its depth (same snap, same pink circle and live value as the horizontal
 * cut of a revolution axis — RevolutionAxisCutOverlayThreed). Live preview =
 * the face and the clipping plane moved in place (no rebuild); release
 * persists the depth on the base map (setBaseMapClipDepthService). Escape
 * cancels.
 *
 * Same method and pointer ownership as
 * useRevolutionAxisCutHandleDragHandlers.
 */
export default function useBaseMapClipBoxDragHandlers({ rendererIsReady }) {
  // Modes that own the pointer (same list as the label drag).
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const meshingTool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode?.active);
  const extrudeActive = useSelector((s) => s.threedEditor.extrudeMode?.active);
  const blockedRef = useRef(false);
  blockedRef.current = Boolean(
    drawingActive ||
    walkActive ||
    extrudeActive ||
    (meshingActive && meshingTool !== "SELECT")
  );

  const dragRef = useRef(null);

  useEffect(() => {
    if (!rendererIsReady) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!dom) return;

    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let hoverCursor = false;

    // Returns the canvas size when the ray could be set, else null.
    function setRayFromEvent(e) {
      const camera = sceneManager.camera;
      const rect = dom.getBoundingClientRect();
      if (!camera || !rect.width || !rect.height) return null;
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      return { width: rect.width, height: rect.height };
    }

    // → { face, handle } under the cursor, or null.
    function pickFace(e) {
      const faces = getBaseMapClipBoxFaces();
      if (!faces.length || !setRayFromEvent(e)) return null;
      const handle = raycaster.intersectObjects(
        faces.flatMap((face) => face.handles),
        false
      )[0]?.object;
      if (!handle) return null;
      const face = faces.find((f) => f.handles.includes(handle));
      return face ? { face, handle } : null;
    }

    function endDrag() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        const controls = sceneManager.controlsManager?.orbitControls;
        if (controls && drag.prevControlsEnabled) controls.enabled = true;
      }
      dom.style.cursor = "";
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
      window.removeEventListener("keydown", onKeyDown, true);
      setMesh3dLabelGestureActive(false);
      clearRevolutionAxisCutOverlay();
      return drag;
    }

    function resetPreview(drag) {
      drag.face.setDepth(drag.depth0);
      sceneManager.renderScene?.();
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (blockedRef.current) return;
      const picked = pickFace(e);
      if (!picked) return;

      // The gesture owns the pointer from here (no click-only case).
      setMesh3dLabelGestureActive(true);
      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls) controls.enabled = false;

      dragRef.current = {
        face: picked.face,
        handle: picked.handle,
        depth0: picked.face.depth,
        // Snap targets, read once at grab time: every scene vertex.
        snapVerts: buildIndex(sceneManager.scene).verts,
        prevControlsEnabled,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
      };

      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);
      window.addEventListener("keydown", onKeyDown, true);
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    function onWindowPointerMove(e) {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved) {
        const dx = Math.abs(e.clientX - drag.startClient.x);
        const dy = Math.abs(e.clientY - drag.startClient.y);
        if (dx <= DRAG_THRESHOLD_PX && dy <= DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        dom.style.cursor = "grabbing";
      }
      const canvasSize = setRayFromEvent(e);
      if (!canvasSize) return;
      // A scene vertex near the cursor wins: the face takes its depth.
      const vertex = findNearestVertexInVerts(
        drag.snapVerts,
        ndc,
        sceneManager.camera,
        canvasSize,
        SNAP_THRESHOLD_PX
      );
      const depth = vertex
        ? drag.face.depthOfWorldPoint(vertex.position)
        : drag.face.depthOfRay(raycaster.ray, drag.handle);
      if (depth == null || !Number.isFinite(depth)) return;
      drag.face.setDepth(roundMm(Math.max(0, depth)));
      sceneManager.renderScene?.();

      // Snap circle on the vertex (only while the face really sits at its
      // depth — not when held on the base map) + live depth.
      const rect = dom.getBoundingClientRect();
      let snap = null;
      if (vertex && Math.abs(drag.face.depth - depth) < 1e-3) {
        const p = vertex.position.clone().project(sceneManager.camera);
        snap = {
          x: ((p.x + 1) / 2) * rect.width,
          y: ((1 - p.y) / 2) * rect.height,
        };
      }
      setRevolutionAxisCutOverlay({
        snap,
        cursor: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          label: `${Math.round(drag.face.depth * 100) / 100} m`,
        },
      });
    }

    async function onWindowPointerUp() {
      const drag = endDrag();
      if (!drag) return;
      const changed =
        drag.moved && Math.abs(drag.face.depth - drag.depth0) > 1e-4;
      if (!changed) {
        resetPreview(drag);
        return;
      }
      try {
        // The preview stays as is: the box and the clipping planes are
        // rebuilt from the stored depth, the scene itself is not.
        await setBaseMapClipDepthService({
          baseMapId: drag.face.baseMapId,
          side: drag.face.side,
          depthM: drag.face.depth,
          dispatch: store.dispatch,
        });
      } catch (err) {
        console.error("[baseMapClipping] clip box drag failed", err);
        resetPreview(drag);
      }
    }

    function onWindowPointerCancel() {
      const drag = endDrag();
      if (drag) resetPreview(drag);
    }

    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      const drag = endDrag();
      if (!drag) return;
      e.preventDefault();
      e.stopPropagation();
      resetPreview(drag);
    }

    // Hover cursor over a handle (outside a drag).
    function onDomPointerMove(e) {
      if (dragRef.current || blockedRef.current) return;
      const over = Boolean(pickFace(e));
      if (over && !hoverCursor) {
        hoverCursor = true;
        dom.style.cursor = "grab";
      } else if (!over && hoverCursor) {
        hoverCursor = false;
        if (dom.style.cursor === "grab") dom.style.cursor = "";
      }
    }

    // Capture phase so the hit-test runs before the camera controls' own
    // pointerdown work (see useAnnotationLabelDragHandlers).
    dom.addEventListener("pointerdown", onPointerDown, true);
    dom.addEventListener("pointermove", onDomPointerMove);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      dom.removeEventListener("pointermove", onDomPointerMove);
      const drag = endDrag();
      if (drag) resetPreview(drag);
    };
  }, [rendererIsReady]);
}
