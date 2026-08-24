import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setRotateBaseMapModeActive,
  setRotateBaseMapCarriedId,
  setRotateBaseMapReferenceSet,
  bumpSnapIndexEpoch,
} from "Features/threedEditor/threedEditorSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import resolveBaseMapGroupFromSnap from "../utils/resolveBaseMapGroupFromSnap";
import db from "App/db/db";

import {
  getLastRotateSnap,
  getRotateGrab,
  setRotateGrab,
  clearRotateGrab,
} from "../services/rotateBaseMapSessionStore";

// Mirrors useMoveBaseMapPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Restores the rotating group to its pivot-click pose (Escape / mode exit).
function restoreRotatedGroup() {
  const grab = getRotateGrab();
  if (!grab) return;
  const editor = getActiveThreedEditor();
  const group = editor?.sceneManager?.imagesManager?.getGroup(grab.baseMapId);
  if (group) {
    group.rotation.y = grab.groupStartRotY;
    group.position.copy(grab.groupStartPosition);
    editor.renderScene?.();
  }
  clearRotateGrab();
}

// Wires click + key handlers for the "Tourner" (rotate base map) mode —
// CAD-style 3 clicks: the 1st snapped click sets the rotation pivot and
// resolves the base map owning the snapped mesh; the 2nd click fixes the
// reference axis from the pivot (the overlay then rotates the whole group,
// image + annotations, around the world-vertical axis through the pivot, by
// the angle between the reference axis and the cursor); the 3rd click
// commits — `angleDeg` and the recomputed `position` are persisted. Esc
// cancels the in-progress rotation, or exits the mode when nothing is
// grabbed.
export default function useRotateBaseMapPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.rotateBaseMapMode.active);

  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    if (!dom) return;

    let downPos = null;
    let isDragging = false;

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      isDragging = false;
    }

    function onPointerMove(e) {
      if (!downPos) return;
      const dx = Math.abs(e.clientX - downPos.x);
      const dy = Math.abs(e.clientY - downPos.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) isDragging = true;
    }

    function grabPivotAtSnap(snap) {
      const scene = editor?.sceneManager?.scene;
      const { group, baseMapId } = resolveBaseMapGroupFromSnap(editor, snap);
      if (!group || !baseMapId) {
        dispatch(
          setToaster({
            message:
              "Sélectionnez un point d'un fond de plan ou d'une de ses annotations",
          })
        );
        return;
      }

      // Fresh target-only snap index, excluding the whole rotated subtree
      // (same rationale as the "Déplacer" tool).
      const { verts: targetVerts, adjacency: targetAdjacency } = buildIndex(
        scene,
        { excludeSubtree: group }
      );

      setRotateGrab({
        baseMapId,
        pivot: snap.position.clone(),
        groupStartPosition: group.position.clone(),
        groupStartRotY: group.rotation.y,
        refPoint: null,
        refBearing: null,
        currentPhi: 0,
        targetVerts,
        targetAdjacency,
      });
      dispatch(setRotateBaseMapCarriedId(baseMapId));
    }

    // 2nd click: fix the reference axis (pivot → clicked point). A click on
    // the pivot itself is degenerate — ignored.
    function fixReferenceAxis(grab, target) {
      const dx = target.position.x - grab.pivot.x;
      const dz = target.position.z - grab.pivot.z;
      if (Math.hypot(dx, dz) < 0.005) return;
      grab.refPoint = target.position.clone();
      grab.refBearing = Math.atan2(-dz, dx);
      grab.currentPhi = 0;
      dispatch(setRotateBaseMapReferenceSet(true));
    }

    async function commitRotation(grab) {
      const group = editor?.sceneManager?.imagesManager?.getGroup(
        grab.baseMapId
      );
      clearRotateGrab();
      dispatch(setRotateBaseMapCarriedId(null));
      if (!group) return;

      // The overlay already posed the group — persist its live pose (same
      // contract as the transform gizmo's drag-end callback).
      const angleDeg = (group.rotation.y * 180) / Math.PI;
      const position = {
        x: group.position.x,
        y: group.position.y,
        z: group.position.z,
      };
      try {
        await db.baseMaps.update(grab.baseMapId, { angleDeg, position });
        dispatch(triggerBaseMapsUpdate());
      } catch (err) {
        console.error("[threedBaseMapMove] rotate persist failed", err);
      }
      // Refresh the snap index with the rotated geometry.
      dispatch(bumpSnapIndexEpoch());
    }

    async function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = isDragging;
      downPos = null;
      isDragging = false;
      if (wasDrag) return;

      const grab = getRotateGrab();
      if (!grab) {
        // Pivot click: snapped points only.
        const snap = getLastRotateSnap();
        if (snap?.kind !== "VERTEX" || !snap?.position) return;
        grabPivotAtSnap(snap);
      } else if (grab.refBearing == null) {
        // Reference-axis click: snapped or free point.
        const target = getLastRotateSnap();
        if (!target?.position) return;
        fixReferenceAxis(grab, target);
      } else {
        await commitRotation(grab);
      }
    }

    function onPointerCancel() {
      downPos = null;
      isDragging = false;
    }

    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (getRotateGrab()) {
        // Cancel the in-progress rotation: put the group back.
        restoreRotatedGroup();
        dispatch(setRotateBaseMapCarriedId(null));
      } else {
        dispatch(setRotateBaseMapModeActive(false));
      }
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      // Leaving the mode mid-rotation: put the group back.
      restoreRotatedGroup();
    };
  }, [active, dispatch]);
}
