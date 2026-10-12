import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setRotateAnnotationModeActive,
  setRotateAnnotationCarriedIds,
  setRotateAnnotationReferenceSet,
  bumpSnapIndexEpoch,
} from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import createTransformedAnnotationCopiesService from "Features/annotationTransform/services/createTransformedAnnotationCopiesService";
import { appendToRotateBuffer } from "Features/annotationTransform/utils/copyBuffer";

import resolveAnnotationFromSnap from "../utils/resolveAnnotationFromSnap";
import getCarriedAnnotationIdsFromSelection from "../utils/getCarriedAnnotationIdsFromSelection";
import { isPointBasedAnnotationType } from "../utils/annotationTransformTypes";
import commitAnnotationsTransformFrom3d from "../services/commitAnnotationsTransformFrom3d";
import setRotateAngleBufferService from "../services/setRotateAngleBufferService";
import {
  disposeCopyGhosts,
  getGrabCopyCount,
  holdCopyGhostsUntilBuilt,
  poseCopyGhostsRotated,
} from "../services/moveCopyGhostsThreed";
import {
  getLastRotateAnnotationSnap,
  getRotateAnnotationGrab,
  setRotateAnnotationGrab,
  clearRotateAnnotationGrab,
} from "../services/rotateAnnotationSessionStore";

// Mirrors useRotateBaseMapPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Characters accepted by the typed `<angle>[*<copies>]` buffer (degrees;
// appendToRotateBuffer validates the grammar).
const ANGLE_BUFFER_CHAR_RE = /^[0-9.,*-]$/;

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
// (Escape / mode exit) and drops the copy ghosts.
function restoreRotatedAnnotations() {
  const grab = getRotateAnnotationGrab();
  if (!grab) return;
  const editor = getActiveThreedEditor();
  disposeCopyGhosts(grab);
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
// Typed buffer in the rotation phase (`<angle>[*<copies>]`): digits lock
// the angle; `*` + digits ("*3") keep the originals in place and preview N
// copies turned by i × the angle (moveCopyGhostsThreed), the commit writes
// the copies (createTransformedAnnotationCopiesService).
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
        ghosts: [],
        // Resolved snapshot of the carried annotations (copy ghosts).
        carriedAnnotations: (annotationsRef.current ?? []).filter((a) =>
          carriedIds.includes(a.id)
        ),
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

    // « Copie multiple »: the originals never moved; the ghosts stand for
    // the copies until the AnnotationsManager has built them. The pixel
    // transform mirrors commitAnnotationsTransformFrom3d (local y up → pixel
    // y down: pivot Y flipped, angle negated).
    async function commitRotatedCopies(grab) {
      const phi = grab.currentPhi;
      const count = getGrabCopyCount(grab);
      const imagesManager = editor?.sceneManager?.imagesManager;
      const metrics = getBaseMapForRender(
        imagesManager?.baseMapsMap?.[grab.baseMapId]
      );
      if (!phi || !metrics) {
        disposeCopyGhosts(grab);
        clearRotateAnnotationGrab();
        dispatch(setRotateAnnotationCarriedIds([]));
        return;
      }
      poseCopyGhostsRotated(grab, phi);
      const ghostsHolder = { ghosts: grab.ghosts };
      grab.ghosts = [];
      clearRotateAnnotationGrab();
      dispatch(setRotateAnnotationCarriedIds([]));

      const { meterByPx, imageWidth, imageHeight } = metrics;
      let newAnnotationIds = [];
      try {
        const result = await createTransformedAnnotationCopiesService({
          annotations: (annotationsRef.current ?? []).filter((a) =>
            grab.annotationIds.includes(a.id)
          ),
          transform: {
            kind: "ROTATE",
            pivotPx: {
              x: imageWidth / 2 + grab.pivotLocal.x / meterByPx,
              y: imageHeight / 2 - grab.pivotLocal.y / meterByPx,
            },
            angleDeg: (-phi * 180) / Math.PI,
          },
          count,
          imageSize: { width: imageWidth, height: imageHeight },
          projectId: store.getState().projects.selectedProjectId,
          activeLayerId: store.getState().layers?.activeLayerId,
          dispatch,
        });
        newAnnotationIds = result?.newAnnotationIds ?? [];
      } catch (err) {
        console.error(
          "[threedAnnotationMove] rotated copies persist failed",
          err
        );
      }
      holdCopyGhostsUntilBuilt(editor, ghostsHolder, newAnnotationIds);
      if (newAnnotationIds.length) dispatch(bumpSnapIndexEpoch());
    }

    async function commitRotation(grab) {
      if (getGrabCopyCount(grab) > 0) {
        await commitRotatedCopies(grab);
        return;
      }
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

    // Typed buffer → slice, ghosts, immediate pose (the overlay redraws its
    // helpers on the next pointer move).
    function setAngleBuffer(grab, buffer) {
      setRotateAngleBufferService({ editor, buffer, dispatch });
    }

    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const grab = getRotateAnnotationGrab();

      if (e.key === "Escape") {
        if (grab?.angleBuffer) {
          // Drop the typed angle / copies first (back to the mouse-driven
          // angle).
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
        e.preventDefault();
        e.stopPropagation();
        const next = appendToRotateBuffer(grab.angleBuffer, e.key);
        if (next !== grab.angleBuffer) setAngleBuffer(grab, next);
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
