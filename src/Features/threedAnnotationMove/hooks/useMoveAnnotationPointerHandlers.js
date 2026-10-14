import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setMoveAnnotationModeActive,
  setMoveAnnotationCarriedIds,
  setMoveAnnotationCopyBuffer,
  setMoveAnnotationRepeat,
  bumpSnapIndexEpoch,
} from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import createTransformedAnnotationCopiesService from "Features/annotationTransform/services/createTransformedAnnotationCopiesService";
import {
  appendToMoveBuffer,
  getBufferValuePart,
} from "Features/annotationTransform/utils/copyBuffer";
import { MULTI_COPY_UNSUPPORTED_MESSAGE } from "Features/annotationTransform/constants/transformToolStrings";
import setMoveCopyBufferService from "../services/setMoveCopyBufferService";
import armMoveCopyThreedService from "../services/armMoveCopyThreedService";
import buildMoveAnnotationGrab, {
  refreshMoveAnnotationGrabTargets,
} from "../services/buildMoveAnnotationGrab";
import rearmMoveAnnotationAfterCommit from "../services/rearmMoveAnnotationAfterCommit";

import resolveAnnotationFromSnap from "../utils/resolveAnnotationFromSnap";
import commitRevolutionAxisMoveFrom3d from "../services/commitRevolutionAxisMoveFrom3d";
import getCarriedAnnotationIdsFromSelection from "../utils/getCarriedAnnotationIdsFromSelection";
import { isPointBasedAnnotationType } from "../utils/annotationTransformTypes";
import applyMoveAnnotationsPose, {
  computeMoveDeltaLocal,
} from "../utils/applyMoveAnnotationsPose";
import commitAnnotationsTransformFrom3d from "../services/commitAnnotationsTransformFrom3d";
import {
  buildCopyGhosts,
  disposeCopyGhosts,
  getGrabCopyCount,
  getGrabMoveLength,
  holdCopyGhostsUntilBuilt,
  poseCopyGhosts,
} from "../services/moveCopyGhostsThreed";
import {
  getLastMoveAnnotationSnap,
  getMoveAnnotationGrab,
  clearMoveAnnotationGrab,
  replayMoveOverlay,
} from "../services/moveAnnotationSessionStore";

// Mirrors useMoveBaseMapPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

const ZERO_DELTA = { x: 0, y: 0, z: 0 };

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

// Restores the carried annotation roots to their grab-time poses (Escape /
// mode exit) and drops the copy ghosts.
function restoreCarriedAnnotations() {
  const grab = getMoveAnnotationGrab();
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
// Typed buffer while carrying (`<distance>[*<copies>]`): digits constrain
// the distance along the current direction; `*` + digits ("*3") keep the
// originals in place and preview N copies (moveCopyGhostsThreed), the drop
// writes the copies (createTransformedAnnotationCopiesService). The buffer
// may be typed ahead of the grab (slice), the grab picks it up.
// « Recommencer à chaque clic » (R, slice `repeat`): the grab survives the
// drop — the same copies again (fresh ghosts), or the moved annotations
// grabbed again at the destination once rebuilt
// (rearmMoveAnnotationAfterCommit); « Copier » (C): one copy per click,
// repeat on (armMoveCopyThreedService). Shift (ortho lock) is handled by the
// overlay.
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
      // A revolution axis is moved alone: the move re-positions it on its
      // origin base map, altitude included on a real snap
      // (commitRevolutionAxisMoveFrom3d).
      const isRevolutionAxis = resolved.annotationType === "REVOLUTION_AXIS";
      if (
        !isRevolutionAxis &&
        !isPointBasedAnnotationType(resolved.annotationType)
      ) {
        dispatch(
          setToaster({
            message:
              "Ce type d'annotation ne peut pas être déplacé ici (tracé à points requis)",
            severity: "warning",
          })
        );
        return;
      }

      const annotationIds = isRevolutionAxis
        ? [resolved.annotationId]
        : getCarriedAnnotationIdsFromSelection({
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

      // The buffer typed ahead of the grab is picked up — minus its `*N`
      // tail on a revolution axis (moved alone, never copied).
      const armedBuffer =
        store.getState().threedEditor.moveAnnotationMode.copyBuffer ?? "";
      const copyBuffer = isRevolutionAxis
        ? getBufferValuePart(armedBuffer)
        : armedBuffer;
      if (isRevolutionAxis && armedBuffer.includes("*")) toastCopiesRefused();

      const carriedIds = buildMoveAnnotationGrab({
        editor,
        annotationIds,
        baseMapId: resolved.baseMapId,
        group: resolved.group,
        snapPosition: snap.position,
        isRevolutionAxis,
        copyBuffer,
        annotations: annotationsRef.current,
      });
      if (!carriedIds.length) return;
      dispatch(setMoveAnnotationCarriedIds(carriedIds));
      if (copyBuffer !== armedBuffer)
        dispatch(setMoveAnnotationCopyBuffer(copyBuffer));
      // Copies typed ahead: the ghosts stand in from the first pointer move.
      const grab = getMoveAnnotationGrab();
      if (grab && getGrabCopyCount(grab) > 0) {
        buildCopyGhosts(editor, grab, grab.carriedAnnotations);
        poseCopyGhosts(grab, ZERO_DELTA);
        editor?.renderScene?.();
      }
    }

    function toastCopiesRefused() {
      dispatch(
        setToaster({
          message: MULTI_COPY_UNSUPPORTED_MESSAGE,
          severity: "warning",
        })
      );
    }

    // Typed buffer → slice, ghosts, immediate re-pose (shared with the
    // helper's fields).
    function setCopyBuffer(grab, buffer) {
      setMoveCopyBufferService({ editor, buffer, dispatch });
    }

    // Typed ahead of the grab: the slice only (the grab picks it up).
    function setArmedCopyBuffer(buffer) {
      dispatch(setMoveAnnotationCopyBuffer(buffer));
    }

    function isRepeatOn() {
      return Boolean(store.getState().threedEditor.moveAnnotationMode.repeat);
    }

    // The carry ends (drop, cancel): the typed buffer goes with it.
    function endCarry() {
      clearMoveAnnotationGrab();
      dispatch(setMoveAnnotationCarriedIds([]));
      dispatch(setMoveAnnotationCopyBuffer(""));
    }

    async function dropCopiesAtSnap(grab, snap) {
      const delta = computeMoveDeltaLocal(editor, grab, snap.position, {
        includeZ: snap.kind !== "FREE",
        lengthM: getGrabMoveLength(grab),
      });
      const count = getGrabCopyCount(grab);
      const imagesManager = editor?.sceneManager?.imagesManager;
      const metrics = getBaseMapForRender(
        imagesManager?.baseMapsMap?.[grab.baseMapId]
      );
      if (!delta || !metrics) {
        disposeCopyGhosts(grab);
        endCarry();
        return;
      }
      poseCopyGhosts(grab, delta);
      // The originals never moved; the ghosts stand for the copies until the
      // AnnotationsManager has built them.
      const ghostsHolder = { ghosts: grab.ghosts };
      grab.ghosts = [];
      // « Recommencer à chaque clic »: the grab survives as is (the originals
      // are still at their grab pose) with a fresh set of ghosts for the next
      // copies, posed at the last delta until the pointer moves.
      const repeat = isRepeatOn();
      if (repeat) {
        buildCopyGhosts(editor, grab, grab.carriedAnnotations);
        poseCopyGhosts(grab, grab.lastDelta ?? delta);
      } else {
        endCarry();
      }

      const { meterByPx, imageWidth, imageHeight } = metrics;
      let newAnnotationIds = [];
      try {
        const result = await createTransformedAnnotationCopiesService({
          annotations: (annotationsRef.current ?? []).filter((a) =>
            grab.annotationIds.includes(a.id)
          ),
          transform: {
            kind: "MOVE",
            deltaPx: { x: delta.x / meterByPx, y: -delta.y / meterByPx },
            deltaZ: delta.z,
          },
          count,
          imageSize: { width: imageWidth, height: imageHeight },
          projectId: store.getState().projects.selectedProjectId,
          activeLayerId: store.getState().layers?.activeLayerId,
          dispatch,
        });
        newAnnotationIds = result?.newAnnotationIds ?? [];
      } catch (err) {
        console.error("[threedAnnotationMove] copies persist failed", err);
      }
      holdCopyGhostsUntilBuilt(editor, ghostsHolder, newAnnotationIds, () => {
        // The written copies are built: they become drop targets of the
        // surviving grab.
        if (repeat && getMoveAnnotationGrab() === grab)
          refreshMoveAnnotationGrabTargets(editor, grab);
      });
      if (newAnnotationIds.length) dispatch(bumpSnapIndexEpoch());
    }

    async function dropAtSnap(grab, snap) {
      if (getGrabCopyCount(grab) > 0) {
        await dropCopiesAtSnap(grab, snap);
        return;
      }
      // The overlay already posed the roots; re-apply from the drop snap to
      // be exact. The poses stay applied — the post-commit rebuild swaps the
      // carried objects with fresh geometry at identity, no visual jump.
      // On a real snap the vertical component follows too (persisted as an
      // offsetZ delta); a free drop stays in the plane.
      const delta = applyMoveAnnotationsPose(editor, grab, snap.position, {
        includeZ: snap.kind !== "FREE",
        lengthM: getGrabMoveLength(grab),
      });
      // « Recommencer à chaque clic »: the moved annotations are grabbed
      // again at the destination once rebuilt (the buffer is kept).
      const rearm = isRepeatOn() && Boolean(delta);
      clearMoveAnnotationGrab();
      dispatch(setMoveAnnotationCarriedIds([]));
      if (!rearm) dispatch(setMoveAnnotationCopyBuffer(""));
      if (!delta) return;
      try {
        if (grab.isRevolutionAxis) {
          await commitRevolutionAxisMoveFrom3d({
            editor,
            axisId: grab.annotationIds[0],
            baseMapId: grab.baseMapId,
            deltaLocal: delta,
            dispatch,
          });
        } else {
          await commitAnnotationsTransformFrom3d({
            editor,
            annotationIds: grab.annotationIds,
            baseMapId: grab.baseMapId,
            transform: { kind: "MOVE", deltaLocal: delta },
            allAnnotations: annotationsRef.current,
            projectId: store.getState().projects.selectedProjectId,
            dispatch,
          });
        }
      } catch (err) {
        console.error("[threedAnnotationMove] persist failed", err);
        return;
      }
      if (rearm) {
        rearmMoveAnnotationAfterCommit({
          editor,
          store,
          dispatch,
          annotationIds: grab.annotationIds,
          baseMapId: grab.baseMapId,
          dropWorld: snap.position.clone(),
          copyBuffer: grab.copyBuffer ?? "",
          getAnnotations: () => annotationsRef.current,
        });
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

    // Capture phase: the copy buffer keys must reach the tool before the
    // window-scoped shortcuts of the other features — in particular
    // Backspace, which otherwise opens the delete dialog of the selection
    // (useDeleteAnnotationOnKeyboardInThreedEditor).
    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const grab = getMoveAnnotationGrab();
      // Armed (nothing grabbed): the buffer typed ahead, in the slice.
      const armedBuffer =
        store.getState().threedEditor.moveAnnotationMode.copyBuffer ?? "";
      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
      };

      if (e.key === "Escape") {
        if (grab?.copyBuffer) {
          // Drop the typed copies first (back to a plain move).
          setCopyBuffer(grab, "");
          consume();
        } else if (grab) {
          // Cancel the in-progress move: put the annotations back.
          restoreCarriedAnnotations();
          dispatch(setMoveAnnotationCarriedIds([]));
          consume();
        } else if (armedBuffer) {
          // Drop the buffer typed ahead before leaving the mode.
          setArmedCopyBuffer("");
          consume();
        } else {
          dispatch(setMoveAnnotationModeActive(false));
        }
        return;
      }

      if (isEditableTarget(e.target)) return;

      // « Recommencer à chaque clic » (R) / « Copier » (C), armed or
      // carrying.
      if (/^[rRcC]$/.test(e.key)) {
        consume();
        if (e.repeat) return;
        if (e.key === "r" || e.key === "R") {
          dispatch(setMoveAnnotationRepeat(!isRepeatOn()));
          // The badge shows / drops the ↻ mark at once.
          replayMoveOverlay();
        } else if (grab?.isRevolutionAxis) {
          toastCopiesRefused();
        } else {
          armMoveCopyThreedService({ editor, store, dispatch });
        }
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        consume();
        if (grab) {
          if (grab.copyBuffer)
            setCopyBuffer(grab, grab.copyBuffer.slice(0, -1));
        } else if (armedBuffer) {
          setArmedCopyBuffer(armedBuffer.slice(0, -1));
        }
        return;
      }

      if (/^[0-9.,*]$/.test(e.key)) {
        consume();
        if (!grab) {
          setArmedCopyBuffer(appendToMoveBuffer(armedBuffer, e.key));
          return;
        }
        if (grab.isRevolutionAxis && e.key === "*") {
          toastCopiesRefused();
          return;
        }
        setCopyBuffer(grab, appendToMoveBuffer(grab.copyBuffer, e.key));
      }
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown, true);
      // Leaving the mode with annotations in hand: put them back.
      restoreCarriedAnnotations();
    };
  }, [active, dispatch, store, canEditAnnotation]);
}
