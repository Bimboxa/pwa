import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setMoveAnnotationModeActive,
  setMoveAnnotationCarriedIds,
} from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";

import resolveAnnotationFromSnap from "../utils/resolveAnnotationFromSnap";
import getCarriedAnnotationIdsFromSelection from "../utils/getCarriedAnnotationIdsFromSelection";
import { isPointBasedAnnotationType } from "../utils/annotationTransformTypes";
import applyMoveAnnotationsPose from "../utils/applyMoveAnnotationsPose";
import commitAnnotationsTransformFrom3d from "../services/commitAnnotationsTransformFrom3d";
import {
  getLastMoveAnnotationSnap,
  getMoveAnnotationGrab,
  setMoveAnnotationGrab,
  clearMoveAnnotationGrab,
} from "../services/moveAnnotationSessionStore";

// Mirrors useMoveBaseMapPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Restores the carried annotation roots to their grab-time poses (Escape /
// mode exit).
function restoreCarriedAnnotations() {
  const grab = getMoveAnnotationGrab();
  if (!grab) return;
  const editor = getActiveThreedEditor();
  const annotationsObjectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  for (const id of grab.annotationIds) {
    const root = annotationsObjectsMap[id];
    const start = grab.rootStartPoses.get(id);
    if (!root || !start) continue;
    root.position.copy(start.position);
    root.rotation.z = start.rotZ;
  }
  editor?.renderScene?.();
  clearMoveAnnotationGrab();
}

// Wires click + key handlers for the "Déplacer" (move annotation) mode of
// the Dessin (MAP) module's 3D editor — mirrors useMoveBaseMapPointerHandlers
// but the carried object is the set of selected point-based annotations of
// one base map:
// 1st snapped click grabs — the click must land on an annotation vertex;
// grabbing an annotation of the current selection carries the whole selection
// as one group, grabbing outside the selection selects and carries that
// annotation alone; 2nd click drops — the new 2D point coordinates are
// written back to db.points (commitAnnotationsTransformFrom3d). Esc cancels
// the in-progress move, or exits the mode when nothing is grabbed.
export default function useMoveAnnotationPointerHandlers({ annotations }) {
  const dispatch = useDispatch();
  const store = useStore();

  const active = useSelector((s) => s.threedEditor.moveAnnotationMode.active);

  const { canEditAnnotation } = useAnnotationPermissions({ annotations });

  // Resolved annotations (pixel points) — ref so the handlers don't
  // re-attach on every annotations run.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  // MAP-module-only mode: force-deactivate on module switch (the pointer
  // effect's cleanup restores the carried poses).
  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  useEffect(() => {
    if (active && moduleKey !== "MAP") {
      dispatch(setMoveAnnotationModeActive(false));
    }
  }, [active, moduleKey, dispatch]);

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
      const resolved = resolveAnnotationFromSnap(editor, snap);
      if (
        !resolved.annotationId ||
        isForeignFootprintId(resolved.annotationId) ||
        !resolved.group ||
        !resolved.baseMapId
      ) {
        dispatch(
          setToaster({ message: "Sélectionnez un point d'une annotation" })
        );
        return;
      }
      if (!isPointBasedAnnotationType(resolved.annotationType)) {
        dispatch(
          setToaster({
            message:
              "Ce type d'annotation ne peut pas être déplacé ici (tracé à points requis)",
            severity: "warning",
          })
        );
        return;
      }

      const annotationIds = getCarriedAnnotationIdsFromSelection({
        grabbed: resolved,
        selectedItems: store.getState().selection.selectedItems,
        allAnnotations: annotationsRef.current,
        dispatch,
      });
      if (!annotationIds.length) return;

      // Ownership: every carried annotation must be editable (the check
      // toasts on refusal).
      for (const id of annotationIds) {
        if (!canEditAnnotation(id)) return;
      }

      const annotationsObjectsMap =
        editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
      const roots = [];
      const rootStartPoses = new Map();
      const carriedIds = [];
      for (const id of annotationIds) {
        const root = annotationsObjectsMap[id];
        if (!root) {
          // Not built in 3D (async load) — can't preview it, leave it out.
          console.warn("[threedAnnotationMove] no 3D object for", id);
          continue;
        }
        roots.push(root);
        rootStartPoses.set(id, {
          position: root.position.clone(),
          rotZ: root.rotation.z,
        });
        carriedIds.push(id);
      }
      if (!carriedIds.length) return;

      const group = resolved.group;
      group.updateWorldMatrix(true, false);
      const startLocal = group.worldToLocal(snap.position.clone());

      // Fresh target-only snap index, excluding every carried annotation
      // root: the carried geometry must never screen the drop targets, and a
      // grab-time rebuild guarantees up-to-date world positions.
      const { verts: targetVerts, adjacency: targetAdjacency } = buildIndex(
        editor?.sceneManager?.scene,
        { excludeSubtrees: roots }
      );

      setMoveAnnotationGrab({
        baseMapId: resolved.baseMapId,
        annotationIds: carriedIds,
        startWorld: snap.position.clone(),
        startLocal: { x: startLocal.x, y: startLocal.y, z: startLocal.z },
        rootStartPoses,
        targetVerts,
        targetAdjacency,
      });
      dispatch(setMoveAnnotationCarriedIds(carriedIds));
    }

    async function dropAtSnap(grab, snap) {
      // The overlay already posed the roots; re-apply from the drop snap to
      // be exact. The poses stay applied — the post-commit rebuild swaps the
      // carried objects with fresh geometry at identity, no visual jump.
      // On a real snap the vertical component follows too (persisted as an
      // offsetZ delta); a free drop stays in the plane.
      const delta = applyMoveAnnotationsPose(editor, grab, snap.position, {
        includeZ: snap.kind !== "FREE",
      });
      clearMoveAnnotationGrab();
      dispatch(setMoveAnnotationCarriedIds([]));
      if (!delta) return;
      try {
        await commitAnnotationsTransformFrom3d({
          editor,
          annotationIds: grab.annotationIds,
          baseMapId: grab.baseMapId,
          transform: { kind: "MOVE", deltaLocal: delta },
          allAnnotations: annotationsRef.current,
          projectId: store.getState().projects.selectedProjectId,
          dispatch,
        });
      } catch (err) {
        console.error("[threedAnnotationMove] persist failed", err);
      }
    }

    async function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = isDragging;
      downPos = null;
      isDragging = false;
      if (wasDrag) return;

      const snap = getLastMoveAnnotationSnap();
      if (!snap?.position) return;

      const grab = getMoveAnnotationGrab();
      if (!grab) {
        // Grab click: an annotation vertex only.
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
      if (getMoveAnnotationGrab()) {
        // Cancel the in-progress move: put the annotations back.
        restoreCarriedAnnotations();
        dispatch(setMoveAnnotationCarriedIds([]));
      } else {
        dispatch(setMoveAnnotationModeActive(false));
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
      // Leaving the mode with annotations in hand: put them back.
      restoreCarriedAnnotations();
    };
  }, [active, dispatch, store, canEditAnnotation]);
}
