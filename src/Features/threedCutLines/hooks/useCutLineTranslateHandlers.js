import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";
import { Raycaster, Vector2, Vector3 } from "three";

import db from "App/db/db";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import getBaseMapNormalWorldFromRow from "Features/baseMaps/js/getBaseMapNormalWorldFromRow";
import {
  selectSelectedItems,
  setSelectedPointIds,
} from "Features/selection/selectionSlice";
import computeAxisLockSnap from "Features/threedAnnotationMove/utils/computeAxisLockSnap";
import {
  clearPendingDimensionPatch,
  setPendingDimensionPatch,
} from "Features/threedDimensions/services/dimensionPendingPatchStore";
import { removeAxisLockLine } from "Features/threedDrawing/utils/axisLockLine";
import { getActiveClippingPlane } from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { clearSubSelection } from "Features/threedEditor/threedEditorSlice";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";

import { CUT_LINE_DRAG_THRESHOLD_PX } from "../constants/cutLineStyle";
import buildCutLineLockLine from "../js/buildCutLineLockLine";
import collectSceneTriangles from "../js/collectSceneTriangles";
import findCutLineVertexAtClient, {
  getSelectedCutLineEntry,
} from "../js/findCutLineVertexAtClient";
import { pickVisibleCutLine } from "../js/pickCutLine";
import {
  setCutLineDragging,
  setCutLineGrabHover,
} from "../services/cutLineHoverStore";
import {
  commitCutLineRebuild,
  computeCutLineRebuild,
} from "../services/rebuildCutLineService";
import findFacePlanesAt from "../utils/findFacePlanesAt";
import getCutLineTranslateAxes from "../utils/getCutLineTranslateAxes";

// The segments of the SELECTED cut line (Features/threedCutLines) in 3D:
//   - hovering one shows the hand (grab) — the vertices keep the priority
//     (useCutLineVertexHandlers);
//   - a drag translates the WHOLE line, locked on a direction that keeps it
//     on its faces (getCutLineTranslateAxes): the perpendicular of the
//     grabbed segment in the plane of the face carrying it, else the user
//     axes (X / Y / Z of the gizmo frame) — with several candidates, the one
//     closest to the cursor on screen (computeAxisLockSnap). A dashed guide
//     shows the direction. Escape cancels.
// A point lying on no solid face sits on its base map (the plan is not in
// the scene soup): the base map plane is its face.
// The gesture is imperative (the line's group is translated, no React state
// until the drop) with the plumbing of the vertex drag: capture-phase
// pointerdown, orbit controls off, the pointerup pick paths stand down past
// the drag threshold, the dropped line published to
// dimensionPendingPatchStore BEFORE the DB write. Drop: the line is rebuilt
// from its translated drawn points (rebuildCutLineService — the extension is
// run again on the scene), one undo step.
export default function useCutLineTranslateHandlers({ rendererIsReady }) {
  const store = useStore();
  const dispatch = useDispatch();
  const baseMaps = useBaseMaps()?.value;
  const baseMapsRef = useRef(baseMaps);
  baseMapsRef.current = baseMaps;

  // Modes that own the pointer — no segment gesture while one is active.
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const meshingTool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode?.active);
  const extrudeActive = useSelector((s) => s.threedEditor.extrudeMode?.active);
  const moveAnnotationActive = useSelector(
    (s) => s.threedEditor.moveAnnotationMode?.active
  );
  const blockedRef = useRef(false);
  blockedRef.current = Boolean(
    drawingActive ||
    walkActive ||
    extrudeActive ||
    moveAnnotationActive ||
    (meshingActive && meshingTool !== "SELECT")
  );

  const yawDeg = useSelector((s) => s.threedEditor.axesSettings?.yawDeg ?? 0);
  const yawDegRef = useRef(yawDeg);
  yawDegRef.current = yawDeg;

  const dragRef = useRef(null);
  const hoverRef = useRef(false);

  useEffect(() => {
    if (!rendererIsReady) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!dom || !sceneManager) return;

    const raycaster = new Raycaster();
    const ndc = new Vector2();

    function getCamera() {
      return sceneManager.camera;
    }

    function setRayFromClient(clientX, clientY) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, getCamera());
      return { width: rect.width, height: rect.height };
    }

    // The segment of the selected cut line under the cursor (not hidden
    // behind a solid), a vertex having the priority. Returns { entry, hit }
    // or null.
    function findSegmentAtClient(clientX, clientY) {
      const selectedItems = selectSelectedItems(store.getState());
      const entry = getSelectedCutLineEntry(selectedItems);
      if (!entry?.lines?.length) return null;
      if (
        findCutLineVertexAtClient({
          selectedItems,
          dom,
          camera: getCamera(),
          clientX,
          clientY,
        })
      ) {
        return null;
      }
      if (!setRayFromClient(clientX, clientY)) return null;
      const hit = pickVisibleCutLine(raycaster, sceneManager, {
        lines: entry.lines,
        clippingPlane: getActiveClippingPlane(sceneManager),
      });
      return hit ? { entry, hit } : null;
    }

    // Lock directions of the grabbed segment (see getCutLineTranslateAxes),
    // as [{ key, dir: Vector3, user }].
    function buildAxes(entry, segmentIndex, grabWorld) {
      const a = entry.vertices[segmentIndex]?.world;
      const b = entry.vertices[segmentIndex + 1]?.world;
      if (!a || !b) return [];
      const baseMap = (baseMapsRef.current || []).find(
        (bm) => bm.id === entry.group?.userData?.baseMapId
      );
      const planNormal = baseMap ? getBaseMapNormalWorldFromRow(baseMap) : null;
      const triangles = collectSceneTriangles(sceneManager);
      const planesAt = (p) => {
        const planes = findFacePlanesAt(triangles, p);
        if (planes.length || !planNormal) return planes;
        return [{ normal: planNormal }];
      };
      return getCutLineTranslateAxes({
        a,
        b,
        grabPlanes: planesAt(grabWorld),
        drawnPlanes: entry.vertices
          .filter((v) => !v.derived)
          .map((v) => planesAt(v.world)),
        userAxes: getUserAxesWorldDirections(yawDegRef.current),
      }).map((axis) => ({
        key: axis.key,
        dir: new Vector3(axis.dir.x, axis.dir.y, axis.dir.z),
        user: axis.user,
      }));
    }

    function removeLockLine(drag) {
      if (!drag?.axisLine) return;
      removeAxisLockLine(drag.axisLine);
      drag.axisLine = null;
      drag.axis = null;
    }

    function updateLockLine(drag, axisKey) {
      if (drag.axis === axisKey && drag.axisLine) return;
      removeLockLine(drag);
      const line = buildCutLineLockLine({
        editor,
        camera: getCamera(),
        origin: drag.grabWorld,
        axis: drag.axes.find((a) => a.key === axisKey),
      });
      if (!line) return;
      sceneManager.scene.add(line);
      drag.axisLine = line;
      drag.axis = axisKey;
    }

    // Rigid preview: the line's group follows the world delta (expressed in
    // its parent's frame — the base map group).
    function applyPreview(drag, deltaWorld) {
      const { group } = drag.entry;
      const parent = group.parent;
      if (!parent) return;
      const from = parent.worldToLocal(drag.grabWorld.clone());
      const to = parent.worldToLocal(drag.grabWorld.clone().add(deltaWorld));
      group.position.copy(drag.startPosition).add(to.sub(from));
      group.updateMatrixWorld(true);
      sceneManager.renderScene?.();
    }

    function restorePreview(drag) {
      const { group } = drag.entry;
      group.position.copy(drag.startPosition);
      group.updateMatrixWorld(true);
      removeLockLine(drag);
      sceneManager.renderScene?.();
    }

    function endDrag() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        const controls = sceneManager.controlsManager?.orbitControls;
        if (controls) controls.enabled = drag.prevControlsEnabled;
        removeLockLine(drag);
        setCutLineDragging(false);
        dom.style.cursor = "";
        sceneManager.renderScene?.();
      }
      setMesh3dLabelGestureActive(false);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
      window.removeEventListener("keydown", onWindowKeyDown, true);
      return drag;
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (blockedRef.current) return;
      if (dragRef.current) return;
      const found = findSegmentAtClient(e.clientX, e.clientY);
      if (!found) return;
      const { entry, hit } = found;
      const segmentIndex = hit.line?.userData?.segmentIndex;
      if (!Number.isInteger(segmentIndex)) return;

      entry.group.updateMatrixWorld(true);
      const grabWorld = hit.point.clone();
      const axes = buildAxes(entry, segmentIndex, grabWorld);
      if (!axes.length) return;

      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls) controls.enabled = false;

      dragRef.current = {
        entry,
        grabWorld,
        axes,
        axis: null,
        axisLine: null,
        startPosition: entry.group.position.clone(),
        prevControlsEnabled,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
        cancelled: false,
        delta: null,
      };
      setCutLineDragging(true);
      dom.style.cursor = "grabbing";

      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);
      window.addEventListener("keydown", onWindowKeyDown, true);

      // Keep camera-controls (registered on the same element) from starting
      // a camera drag with this gesture.
      e.stopImmediatePropagation();
      e.preventDefault();
    }

    function onWindowPointerMove(e) {
      const drag = dragRef.current;
      if (!drag || drag.cancelled) return;
      if (!drag.moved) {
        const dx = Math.abs(e.clientX - drag.startClient.x);
        const dy = Math.abs(e.clientY - drag.startClient.y);
        if (
          dx <= CUT_LINE_DRAG_THRESHOLD_PX &&
          dy <= CUT_LINE_DRAG_THRESHOLD_PX
        )
          return;
        drag.moved = true;
        // From here on the line owns the gesture: the pointerup pick paths
        // stand down.
        setMesh3dLabelGestureActive(true);
      }
      const canvasSize = setRayFromClient(e.clientX, e.clientY);
      if (!canvasSize) return;
      const lock = computeAxisLockSnap({
        mouseNdc: ndc,
        camera: getCamera(),
        canvasSize,
        origin: drag.grabWorld,
        axes: drag.axes,
        raycaster,
      });
      if (!lock) return;
      drag.delta = lock.position.clone().sub(drag.grabWorld);
      updateLockLine(drag, lock.axis);
      applyPreview(drag, drag.delta);
    }

    // Escape: the line goes back; the gesture stays ours until the release
    // (its pointerup must not click whatever lies under the cursor).
    function onWindowKeyDown(e) {
      const drag = dragRef.current;
      if (e.key !== "Escape" || !drag?.moved || drag.cancelled) return;
      drag.cancelled = true;
      drag.delta = null;
      restorePreview(drag);
      e.stopPropagation();
      e.preventDefault();
    }

    async function onWindowPointerUp() {
      const drag = endDrag();
      if (!drag) return;
      // A click (no move): the regular click path of this pointerup runs (a
      // no-op on the line selected alone).
      if (!drag.moved) return;
      if (drag.cancelled) {
        // endDrag released the gesture flag: hold it over this pointerup.
        setMesh3dLabelGestureActive(true);
        setTimeout(() => setMesh3dLabelGestureActive(false), 0);
        return;
      }
      const { entry, delta } = drag;
      if (!delta || delta.lengthSq() < 1e-12) {
        restorePreview(drag);
        return;
      }
      const annotationId = entry.annotationId;

      try {
        const raw = await db.annotations.get(annotationId);
        const baseMap = (baseMapsRef.current || []).find(
          (b) => b.id === raw?.baseMapId
        );
        if (!raw?.points || raw.points.length !== entry.vertices.length) {
          console.warn("[threedCutLines] line drop ignored: stale line");
          restorePreview(drag);
          return;
        }
        // The line is rebuilt from its translated drawn points (fresh rows:
        // a point row is never shared nor moved in place); the extension is
        // run again on the scene — the « Stop » of a derived point follows
        // when the new trace still passes there.
        const drawn = [];
        const oldDerived = [];
        entry.vertices.forEach((v, i) => {
          const ref = raw.points[i];
          const moved = {
            x: v.world.x + delta.x,
            y: v.world.y + delta.y,
            z: v.world.z + delta.z,
          };
          if (ref.derived) {
            oldDerived.push({ ...moved, stop: ref.stop });
          } else {
            drawn.push({ ...moved, ref, newRow: true });
          }
        });
        const result = computeCutLineRebuild({
          raw,
          drawn,
          baseMap,
          editor,
          oldDerived,
        });
        if (!result) {
          console.warn("[threedCutLines] line drop ignored: off the base map");
          restorePreview(drag);
          return;
        }
        setPendingDimensionPatch(annotationId, {
          baseUpdatedAt: raw?.updatedAt ?? null,
          patch: result.patch,
        });
        // Every point got a new row: a sub-selected vertex is gone.
        dispatch(setSelectedPointIds([]));
        dispatch(clearSubSelection());
        await commitCutLineRebuild({
          annotationId,
          pointRows: result.pointRows,
          patch: result.patch,
        });
      } catch (err) {
        clearPendingDimensionPatch(annotationId);
        restorePreview(drag);
        console.error("[threedCutLines] line move persist failed", err);
      }
    }

    function onWindowPointerCancel() {
      const drag = endDrag();
      if (drag) restorePreview(drag);
    }

    // Hand cursor over a segment of the selected line (no gesture running).
    function onDomPointerMove(e) {
      if (dragRef.current) return;
      const over =
        !blockedRef.current &&
        e.buttons === 0 &&
        Boolean(findSegmentAtClient(e.clientX, e.clientY));
      if (over === hoverRef.current) return;
      hoverRef.current = over;
      setCutLineGrabHover("SEGMENT", over, dom);
    }

    dom.addEventListener("pointerdown", onPointerDown, true);
    dom.addEventListener("pointermove", onDomPointerMove);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      dom.removeEventListener("pointermove", onDomPointerMove);
      const drag = endDrag();
      if (drag) restorePreview(drag);
      if (hoverRef.current) {
        hoverRef.current = false;
        setCutLineGrabHover("SEGMENT", false, dom);
      }
    };
  }, [rendererIsReady, store, dispatch]);
}
