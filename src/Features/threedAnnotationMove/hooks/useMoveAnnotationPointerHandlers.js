import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setMoveAnnotationModeActive,
  setMoveAnnotationCarriedIds,
  setMoveAnnotationCopyBuffer,
  bumpSnapIndexEpoch,
} from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import createTranslatedAnnotationCopiesService from "Features/annotationTransform/services/createTranslatedAnnotationCopiesService";
import { appendToMoveBuffer } from "Features/annotationTransform/utils/copyBuffer";
import { MULTI_COPY_UNSUPPORTED_MESSAGE } from "Features/annotationTransform/constants/transformToolStrings";

import resolveAnnotationFromSnap from "../utils/resolveAnnotationFromSnap";
import commitRevolutionAxisMoveFrom3d from "../services/commitRevolutionAxisMoveFrom3d";
import getCarriedAnnotationIdsFromSelection from "../utils/getCarriedAnnotationIdsFromSelection";
import { isPointBasedAnnotationType } from "../utils/annotationTransformTypes";
import applyMoveAnnotationsPose, {
  computeMoveDeltaLocal,
  poseCarriedAnnotations,
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
  replayMoveOverlay,
  setMoveAnnotationGrab,
  clearMoveAnnotationGrab,
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
// writes the copies (createTranslatedAnnotationCopiesService). Shift (ortho
// lock) is handled by the overlay.
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
        isRevolutionAxis,
        rootStartPoses,
        targetVerts,
        targetAdjacency,
        copyBuffer: "",
        ghosts: [],
        lastDelta: ZERO_DELTA,
      });
      dispatch(setMoveAnnotationCarriedIds(carriedIds));
    }

    // Typed buffer: rebuilds the ghosts for a new count and swaps what
    // follows the cursor (ghosts vs the originals), then replays the overlay
    // so the pose and the badge follow the typed distance at once — no
    // pointer move needed to see the change.
    function setCopyBuffer(grab, buffer) {
      const prevCount = getGrabCopyCount(grab);
      grab.copyBuffer = buffer;
      dispatch(setMoveAnnotationCopyBuffer(buffer));
      const count = getGrabCopyCount(grab);
      if (count !== prevCount) {
        if (count > 0) {
          if (prevCount === 0) poseCarriedAnnotations(editor, grab, ZERO_DELTA);
          buildCopyGhosts(editor, grab, annotationsRef.current);
          poseCopyGhosts(grab, grab.lastDelta ?? ZERO_DELTA);
        } else {
          disposeCopyGhosts(grab);
          poseCarriedAnnotations(editor, grab, grab.lastDelta ?? ZERO_DELTA);
        }
      }
      replayMoveOverlay();
      editor.renderScene?.();
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
        clearMoveAnnotationGrab();
        dispatch(setMoveAnnotationCarriedIds([]));
        return;
      }
      poseCopyGhosts(grab, delta);
      // The originals never moved; the ghosts stand for the copies until the
      // AnnotationsManager has built them.
      const ghostsHolder = { ghosts: grab.ghosts };
      grab.ghosts = [];
      clearMoveAnnotationGrab();
      dispatch(setMoveAnnotationCarriedIds([]));

      const { meterByPx, imageWidth, imageHeight } = metrics;
      let newAnnotationIds = [];
      try {
        const result = await createTranslatedAnnotationCopiesService({
          annotations: (annotationsRef.current ?? []).filter((a) =>
            grab.annotationIds.includes(a.id)
          ),
          deltaPx: { x: delta.x / meterByPx, y: -delta.y / meterByPx },
          deltaZ: delta.z,
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
      holdCopyGhostsUntilBuilt(editor, ghostsHolder, newAnnotationIds);
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
      clearMoveAnnotationGrab();
      dispatch(setMoveAnnotationCarriedIds([]));
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
          return;
        }
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

    // Capture phase: the copy buffer keys must reach the tool before the
    // window-scoped shortcuts of the other features — in particular
    // Backspace, which otherwise opens the delete dialog of the selection
    // (useDeleteAnnotationOnKeyboardInThreedEditor).
    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const grab = getMoveAnnotationGrab();
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
        } else {
          dispatch(setMoveAnnotationModeActive(false));
        }
        return;
      }

      if (!grab || isEditableTarget(e.target)) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        consume();
        if (grab.copyBuffer) setCopyBuffer(grab, grab.copyBuffer.slice(0, -1));
        return;
      }

      if (/^[0-9.,*]$/.test(e.key)) {
        consume();
        if (grab.isRevolutionAxis && e.key === "*") {
          dispatch(
            setToaster({
              message: MULTI_COPY_UNSUPPORTED_MESSAGE,
              severity: "warning",
            })
          );
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
