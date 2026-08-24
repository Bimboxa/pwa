import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setMoveBaseMapModeActive,
  setMoveBaseMapCarriedId,
  bumpSnapIndexEpoch,
} from "Features/threedEditor/threedEditorSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import resolveBaseMapGroupFromSnap from "../utils/resolveBaseMapGroupFromSnap";
import findBaseMapGroupsAtVertex from "../utils/findBaseMapGroupsAtVertex";
import db from "App/db/db";

import {
  getLastMoveSnap,
  getMoveGrab,
  setMoveGrab,
  clearMoveGrab,
} from "../services/moveBaseMapSessionStore";

// Mirrors useDimensionPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Restores the carried group to its grab-time position (Escape / mode exit).
function restoreCarriedGroup() {
  const grab = getMoveGrab();
  if (!grab) return;
  const editor = getActiveThreedEditor();
  const group = editor?.sceneManager?.imagesManager?.getGroup(grab.baseMapId);
  if (group) {
    group.position.copy(grab.groupStartPosition);
    editor.renderScene?.();
  }
  clearMoveGrab();
}

// Wires click + key handlers for the "Déplacer" (move base map) mode:
// 1st snapped click grabs — resolves the base map owning the snapped mesh,
// records the grabbed point and the group's start position (the overlay then
// moves the whole group, image + annotations, with the cursor); 2nd click
// drops — persists the base map `position` so the grabbed point lands
// exactly on the drop point (translation only, rotation kept). Esc cancels
// the in-progress move, or exits the mode when nothing is grabbed. A
// press-release pair that moved past DRAG_THRESHOLD_PX is a camera drag,
// not a click.
export default function useMoveBaseMapPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.moveBaseMapMode.active);

  // Selected base map — tie-break of an ambiguous grab vertex (shared by
  // annotations of several base maps). Ref so the handlers don't re-attach.
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const selectedBaseMapIdRef = useRef(selectedBaseMapId);
  useEffect(() => {
    selectedBaseMapIdRef.current = selectedBaseMapId;
  }, [selectedBaseMapId]);

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

    function grabAtSnap(snap) {
      const scene = editor?.sceneManager?.scene;
      let { group, baseMapId } = resolveBaseMapGroupFromSnap(editor, snap);
      // Vertex shared by annotations of several base maps: prefer the
      // SELECTED base map.
      const candidates = findBaseMapGroupsAtVertex(editor, snap.position);
      if (candidates.length > 1) {
        const preferred = candidates.find(
          (c) => c.baseMapId === selectedBaseMapIdRef.current
        );
        if (preferred) ({ group, baseMapId } = preferred);
      }
      if (!group || !baseMapId) {
        dispatch(
          setToaster({
            message:
              "Sélectionnez un point d'un fond de plan ou d'une de ses annotations",
          })
        );
        return;
      }

      // Fresh target-only snap index, excluding the whole carried subtree:
      // the carried geometry must never screen the drop targets, and a
      // grab-time rebuild guarantees up-to-date world positions whatever
      // happened since the mode was armed.
      const { verts: targetVerts, adjacency: targetAdjacency } = buildIndex(
        scene,
        { excludeSubtree: group }
      );

      setMoveGrab({
        baseMapId,
        startWorld: snap.position.clone(),
        groupStartPosition: group.position.clone(),
        targetVerts,
        targetAdjacency,
      });
      dispatch(setMoveBaseMapCarriedId(baseMapId));
    }

    async function dropAtSnap(grab, snap) {
      const group = editor?.sceneManager?.imagesManager?.getGroup(
        grab.baseMapId
      );
      if (!group) {
        clearMoveGrab();
        dispatch(setMoveBaseMapCarriedId(null));
        return;
      }
      // The overlay already placed the group so the grabbed point lands on
      // the target; re-apply from the drop snap to be exact.
      group.position.set(
        grab.groupStartPosition.x + (snap.position.x - grab.startWorld.x),
        grab.groupStartPosition.y + (snap.position.y - grab.startWorld.y),
        grab.groupStartPosition.z + (snap.position.z - grab.startWorld.z)
      );
      editor.renderScene?.();

      const position = {
        x: group.position.x,
        y: group.position.y,
        z: group.position.z,
      };
      clearMoveGrab();
      dispatch(setMoveBaseMapCarriedId(null));
      try {
        await db.baseMaps.update(grab.baseMapId, { position });
        dispatch(triggerBaseMapsUpdate());
      } catch (err) {
        console.error("[threedBaseMapMove] persist failed", err);
      }
      // Refresh the snap index with the moved geometry so the next grab
      // snaps at the new location.
      dispatch(bumpSnapIndexEpoch());
    }

    async function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = isDragging;
      downPos = null;
      isDragging = false;
      if (wasDrag) return;

      const snap = getLastMoveSnap();
      if (!snap?.position) return;

      const grab = getMoveGrab();
      if (!grab) {
        // Grab click: snapped points only — a free click grabs nothing.
        if (snap.kind !== "VERTEX") return;
        grabAtSnap(snap);
      } else {
        await dropAtSnap(grab, snap);
      }
    }

    function onPointerCancel() {
      downPos = null;
      isDragging = false;
    }

    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (getMoveGrab()) {
        // Cancel the in-progress move: put the group back.
        restoreCarriedGroup();
        dispatch(setMoveBaseMapCarriedId(null));
      } else {
        dispatch(setMoveBaseMapModeActive(false));
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
      // Leaving the mode with a base map in hand: put it back.
      restoreCarriedGroup();
    };
  }, [active, dispatch]);
}
