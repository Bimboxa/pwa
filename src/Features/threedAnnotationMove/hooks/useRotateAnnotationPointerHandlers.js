import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setRotateAnnotationModeActive,
  setRotateAnnotationCarriedIds,
  setRotateAnnotationReferenceSet,
  setRotateAnnotationAngleBuffer,
} from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import { parseRotateAngleBuffer } from "Features/threedBaseMapMove/utils/applyRotateBaseMapPose";

import resolveAnnotationFromSnap from "../utils/resolveAnnotationFromSnap";
import getCarriedAnnotationIdsFromSelection from "../utils/getCarriedAnnotationIdsFromSelection";
import { isPointBasedAnnotationType } from "../utils/annotationTransformTypes";
import applyRotateAnnotationsPose from "../utils/applyRotateAnnotationsPose";
import commitAnnotationsTransformFrom3d from "../services/commitAnnotationsTransformFrom3d";
import {
  getLastRotateAnnotationSnap,
  getRotateAnnotationGrab,
  setRotateAnnotationGrab,
  clearRotateAnnotationGrab,
} from "../services/rotateAnnotationSessionStore";

// Mirrors useRotateBaseMapPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Characters accepted by the typed angle buffer (degrees).
const ANGLE_BUFFER_CHAR_RE = /^[0-9.,-]$/;

// Same guard as the 2D hotkeys: never steal keystrokes from a real field.
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

// Restores the rotating annotation roots to their pivot-click poses
// (Escape / mode exit).
function restoreRotatedAnnotations() {
  const grab = getRotateAnnotationGrab();
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
  clearRotateAnnotationGrab();
}

// Wires click + key handlers for the "Tourner" (rotate annotation) mode of
// the Dessin (MAP) module's 3D editor — CAD-style 3 clicks, mirroring
// useRotateBaseMapPointerHandlers but on the selected point-based
// annotations of one base map: the 1st snapped click sets the pivot on an
// annotation (implicit-selection rule, like the move tool); the 2nd click
// fixes the reference axis; the mouse then rotates the carried annotations
// around the base map plane's normal through the pivot; the 3rd click (or
// Enter) commits the new 2D point coordinates. Esc cancels the in-progress
// rotation, or exits the mode when nothing is grabbed.
export default function useRotateAnnotationPointerHandlers({ annotations }) {
  const dispatch = useDispatch();
  const store = useStore();

  const active = useSelector((s) => s.threedEditor.rotateAnnotationMode.active);

  const { canEditAnnotation } = useAnnotationPermissions({ annotations });

  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  // MAP-module-only mode: force-deactivate on module switch (the pointer
  // effect's cleanup restores the carried poses).
  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  useEffect(() => {
    if (active && moduleKey !== "MAP") {
      dispatch(setRotateAnnotationModeActive(false));
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

    function grabPivotAtSnap(snap) {
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
              "Ce type d'annotation ne peut pas être tourné ici (tracé à points requis)",
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
      const pivotLocal = group.worldToLocal(snap.position.clone());

      // Fresh target-only snap index, excluding every carried annotation
      // root (same rationale as the move tool).
      const { verts: targetVerts, adjacency: targetAdjacency } = buildIndex(
        editor?.sceneManager?.scene,
        { excludeSubtrees: roots }
      );

      setRotateAnnotationGrab({
        baseMapId: resolved.baseMapId,
        annotationIds: carriedIds,
        pivot: snap.position.clone(),
        pivotLocal: { x: pivotLocal.x, y: pivotLocal.y, z: pivotLocal.z },
        rootStartPoses,
        refPoint: null,
        refBearing: null,
        currentPhi: 0,
        angleBuffer: "",
        targetVerts,
        targetAdjacency,
      });
      dispatch(setRotateAnnotationCarriedIds(carriedIds));
    }

    // 2nd click: fix the reference axis (pivot → clicked point), measured in
    // the base map's LOCAL XY frame. A click on the pivot itself is
    // degenerate — ignored.
    function fixReferenceAxis(grab, target) {
      const group = editor?.sceneManager?.imagesManager?.getGroup(
        grab.baseMapId
      );
      if (!group) return;
      group.updateWorldMatrix(true, false);
      const local = group.worldToLocal(target.position.clone());
      const dx = local.x - grab.pivotLocal.x;
      const dy = local.y - grab.pivotLocal.y;
      if (Math.hypot(dx, dy) < 0.005) return;
      grab.refPoint = target.position.clone();
      grab.refBearing = Math.atan2(dy, dx);
      grab.currentPhi = 0;
      dispatch(setRotateAnnotationReferenceSet(true));
    }

    async function commitRotation(grab) {
      const phi = grab.currentPhi;
      // The overlay already posed the roots — the poses stay applied, the
      // post-commit rebuild swaps the carried objects with fresh geometry.
      clearRotateAnnotationGrab();
      dispatch(setRotateAnnotationCarriedIds([]));
      if (!phi) return;
      try {
        await commitAnnotationsTransformFrom3d({
          editor,
          annotationIds: grab.annotationIds,
          baseMapId: grab.baseMapId,
          transform: {
            kind: "ROTATE",
            pivotLocal: grab.pivotLocal,
            phi,
          },
          allAnnotations: annotationsRef.current,
          projectId: store.getState().projects.selectedProjectId,
          dispatch,
        });
      } catch (err) {
        console.error("[threedAnnotationMove] rotate persist failed", err);
      }
    }

    async function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = isDragging;
      downPos = null;
      isDragging = false;
      if (wasDrag) return;

      const grab = getRotateAnnotationGrab();
      if (!grab) {
        // Pivot click: an annotation vertex only.
        const snap = getLastRotateAnnotationSnap();
        if (!snap?.position) return;
        if (snap.kind !== "VERTEX") return;
        grabPivotAtSnap(snap);
      } else if (grab.refBearing == null) {
        // Reference-axis click: snapped or free point.
        const target = getLastRotateAnnotationSnap();
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

    function setAngleBuffer(grab, buffer) {
      grab.angleBuffer = buffer;
      dispatch(setRotateAnnotationAngleBuffer(buffer));
      // Immediate visual feedback: pose the annotations for the typed angle
      // (the overlay redraws its helpers on the next pointer move).
      const phi = parseRotateAngleBuffer(buffer);
      if (phi != null) applyRotateAnnotationsPose(editor, grab, phi);
    }

    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const grab = getRotateAnnotationGrab();

      if (e.key === "Escape") {
        if (grab?.angleBuffer) {
          // Drop the typed angle first (back to the mouse-driven angle).
          setAngleBuffer(grab, "");
        } else if (grab) {
          // Cancel the in-progress rotation: put the annotations back.
          restoreRotatedAnnotations();
          dispatch(setRotateAnnotationCarriedIds([]));
        } else {
          dispatch(setRotateAnnotationModeActive(false));
        }
        return;
      }

      // Typed angle buffer — rotation phase only, and never steal keystrokes
      // from a real field (the toolbar field feeds the same buffer through
      // onChangeText).
      if (!grab || grab.refBearing == null) return;

      if (e.key === "Enter") {
        commitRotation(grab);
        return;
      }

      if (isEditableTarget(e.target)) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        if (!grab.angleBuffer) return;
        e.preventDefault();
        e.stopPropagation();
        setAngleBuffer(grab, grab.angleBuffer.slice(0, -1));
        return;
      }
      if (ANGLE_BUFFER_CHAR_RE.test(e.key)) {
        // A minus only makes sense as the first character.
        if (e.key === "-" && grab.angleBuffer !== "") return;
        e.preventDefault();
        e.stopPropagation();
        setAngleBuffer(grab, grab.angleBuffer + (e.key === "," ? "." : e.key));
      }
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    // Capture phase: the typed digits / Backspace must reach the buffer
    // before the window-scoped shortcuts of the other features (same as the
    // extrude value buffer).
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown, true);
      // Leaving the mode mid-rotation: put the annotations back.
      restoreRotatedAnnotations();
    };
  }, [active, dispatch, store, canEditAnnotation]);
}
