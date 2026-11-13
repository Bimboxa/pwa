import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import { Raycaster, Vector2 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import findNearestVertexInVerts from "Features/threedBaseMapMove/utils/findNearestVertexInVerts";
import { getRevolutionAxisCuts } from "Features/revolutionAxes/services/revolutionAxisCutsStore";
import setRevolutionAxisHorizontalCutService from "Features/revolutionAxes/services/setRevolutionAxisHorizontalCutService";

const DRAG_THRESHOLD_PX = 3;
// A scene vertex this close to the cursor (screen px) gives its altitude.
const SNAP_THRESHOLD_PX = 12;

const roundMm = (v) => Math.round(v * 1e3) / 1e3;

/**
 * Drag of the horizontal-cut handle of a revolution axis in the 3D editor
 * (built by ThreedRevolutionAxisHorizontalCuts): the handle slides along the
 * axis under the cursor and the cut plane follows — `horizontalCutZ`, metres
 * above the base of the axis, never below it. A scene vertex near the cursor
 * wins: the cut takes its altitude (same snap as the push / pull of the
 * extrude tool). Live preview = the clipping plane moved in place (no
 * rebuild); release persists the altitude on the axis
 * (setRevolutionAxisHorizontalCutService). Escape cancels.
 *
 * Pointer ownership mirrors useRevolutionAxisHandleDragHandlers.
 */
export default function useRevolutionAxisCutHandleDragHandlers({
  rendererIsReady,
}) {
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

    function pickCut(e) {
      const cuts = getRevolutionAxisCuts();
      if (!cuts.length || !setRayFromEvent(e)) return null;
      const hit = raycaster.intersectObjects(
        cuts.map((cut) => cut.handle),
        false
      )[0]?.object;
      return hit ? (cuts.find((cut) => cut.handle === hit) ?? null) : null;
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
      return drag;
    }

    function resetPreview(drag) {
      drag.cut.setZ(drag.z0);
      sceneManager.renderScene?.();
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (blockedRef.current) return;
      const cut = pickCut(e);
      if (!cut) return;

      // The gesture owns the pointer from here (no click-only case).
      setMesh3dLabelGestureActive(true);
      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls) controls.enabled = false;

      dragRef.current = {
        cut,
        z0: cut.z,
        // Snap targets: every scene vertex, read once at grab time.
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
      // A scene vertex near the cursor wins: the cut takes its altitude.
      const vertex = findNearestVertexInVerts(
        drag.snapVerts,
        ndc,
        sceneManager.camera,
        canvasSize,
        SNAP_THRESHOLD_PX
      );
      const z = vertex
        ? drag.cut.zOfWorldPoint(vertex.position)
        : drag.cut.zOfRay(raycaster.ray);
      if (z == null || !Number.isFinite(z)) return;
      drag.cut.setZ(roundMm(Math.max(0, z)));
      sceneManager.renderScene?.();
    }

    async function onWindowPointerUp() {
      const drag = endDrag();
      if (!drag) return;
      const changed = drag.moved && Math.abs(drag.cut.z - drag.z0) > 1e-4;
      if (!changed) {
        resetPreview(drag);
        return;
      }
      try {
        // The preview stays as is: the cut is rebuilt from the stored
        // altitude (live query of ThreedRevolutionAxisHorizontalCuts), the
        // scene itself is not.
        await setRevolutionAxisHorizontalCutService(drag.cut.axisId, {
          z: drag.cut.z,
        });
      } catch (err) {
        console.error("[revolutionAxes] 3D horizontal cut drag failed", err);
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
      const over = Boolean(pickCut(e));
      if (over && !hoverCursor) {
        hoverCursor = true;
        dom.style.cursor = "ns-resize";
      } else if (!over && hoverCursor) {
        hoverCursor = false;
        if (dom.style.cursor === "ns-resize") dom.style.cursor = "";
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
