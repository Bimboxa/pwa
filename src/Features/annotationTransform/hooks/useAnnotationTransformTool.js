import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import { isPointBasedAnnotationType } from "Features/threedAnnotationMove/utils/annotationTransformTypes";
import getCarriedAnnotationIdsFromSelection from "Features/threedAnnotationMove/utils/getCarriedAnnotationIdsFromSelection";

import moveRevolutionAxisCenterService from "Features/revolutionAxes/services/moveRevolutionAxisCenterService";

import commitAnnotationsTransform2d from "../services/commitAnnotationsTransform2d";
import createTransformedAnnotationCopiesService from "../services/createTransformedAnnotationCopiesService";
import {
  constrainMoveCursor,
  getTransformCopyCount,
  getTransformSession,
  resetTransformSession,
  setMoveCopyBuffer,
  setMoveCursor,
  setRotateAngleBuffer,
  setTransformSession,
} from "../services/transformSessionStore";
import {
  MOVE_ANNOTATION_MODE,
  ROTATE_ANNOTATION_MODE,
  isTransformToolMode,
} from "../utils/transformToolModes";
import {
  ROTATE_SHIFT_STEP_DEG,
  getOrthoConstrainedPoint,
  getRotatePixelAngleDeg,
} from "../utils/rotateAngle";
import { appendToMoveBuffer, appendToRotateBuffer } from "../utils/copyBuffer";
import {
  MULTI_COPY_UNSUPPORTED_MESSAGE,
  ROTATE_FREE_PIVOT_NO_SELECTION_MESSAGE,
  TRANSFORM_UNSUPPORTED_GRAB_MESSAGE,
} from "../constants/transformToolStrings";

// The preview stays this long at most after a commit, waiting for the
// annotations to come back from the db (TransformToolPreviewLayer clears it
// as soon as they do).
const COMMIT_PREVIEW_FALLBACK_MS = 600;
// A destination this close to the grabbed point is a no-op.
const MIN_MOVE_PX = 1e-6;

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

// ---------------------------------------------------------------------------
// useAnnotationTransformTool — 2D « Déplacer » (MOVE_ANNOTATION) and
// « Tourner » (ROTATE_ANNOTATION) drawing modes: same gesture as the 3D tools
// (threedAnnotationMove), in the base map's pixel frame.
//   Déplacer: click a point of an annotation, click the destination. While
//   carrying, digits ("1.3") constrain the distance along the cursor
//   direction and `*` + digits ("*3") turn the move into a « copie
//   multiple »: the originals stay, N copies land along the vector (copy i
//   at i × it) — "1.3*3": 3 copies with a 1.30 m pitch.
//   Tourner: click the pivot on an annotation, click a point fixing the
//   reference axis, turn with the mouse (Shift: 15° steps) or type the angle,
//   click / Enter to validate. `*` + digits ("45*3") turn the rotation into
//   a « copie multiple »: the originals stay, N copies turned by i × the
//   angle around the pivot.
// The grabbed annotation carries the whole selection when it belongs to it
// (getCarriedAnnotationIdsFromSelection — shared with the 3D tools).
// A revolution axis is moved alone, from its centre or one of the ends of its
// contour (not turned). The rotation pivot may be a free point of the base
// map when the annotations to turn are selected (the selection is carried).
//
// Returns the handlers InteractionLayer calls from its click / snap-marker /
// mouse-move paths; the session lives in transformSessionStore.
// ---------------------------------------------------------------------------

export default function useAnnotationTransformTool({
  annotations,
  baseMap,
  projectId,
}) {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const active = isTransformToolMode(enabledDrawingMode);

  const { canEditAnnotation } = useAnnotationPermissions({ annotations });

  // Resolved annotations (pixel points) — refs so the handlers stay stable.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const baseMapRef = useRef(baseMap);
  baseMapRef.current = baseMap;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // helpers

  // A revolution axis is carried alone (grab): the copy buffer refuses it.
  const isRevolutionAxisCarried = useCallback((session) => {
    const ids = session.carriedAnnotationIds;
    if (ids.length !== 1) return false;
    const a = annotationsRef.current?.find((ann) => ann.id === ids[0]);
    return a?.type === "REVOLUTION_AXIS";
  }, []);

  // snap: the clicked point ({x, y} in the pixel frame) with the snapped
  // annotation's id when the click landed on one (annotationId /
  // previewAnnotationId); a ROTATE pivot may be a free point.
  const grab = useCallback(
    (kind, snap) => {
      // A selection made before arming the tool is what the tool carries:
      // the clicked point is only the reference point — it must not hand the
      // gesture over to another annotation that happens to share that point.
      const selectedItems = store.getState().selection.selectedItems;
      const selectedIds = (selectedItems ?? [])
        .filter((i) => i.type === "NODE" && i.nodeType === "ANNOTATION")
        .map((i) => i.nodeId ?? i.id);
      const snapAnnotationId = snap?.annotationId ?? snap?.previewAnnotationId;
      const selectedCarriable = selectedIds.filter((id) => {
        const a = annotationsRef.current?.find((ann) => ann.id === id);
        return (
          a && !isForeignFootprintId(id) && isPointBasedAnnotationType(a.type)
        );
      });
      const annotationId = selectedCarriable.length
        ? selectedCarriable.includes(snapAnnotationId)
          ? snapAnnotationId
          : selectedCarriable[0]
        : snapAnnotationId;
      const annotation = annotationId
        ? annotationsRef.current?.find((a) => a.id === annotationId)
        : null;
      if (!annotation || isForeignFootprintId(annotationId)) {
        dispatch(
          setToaster({
            message:
              kind === "ROTATE" && !snapAnnotationId
                ? ROTATE_FREE_PIVOT_NO_SELECTION_MESSAGE
                : TRANSFORM_UNSUPPORTED_GRAB_MESSAGE,
          })
        );
        return;
      }
      // A revolution axis can be MOVED (alone): the move re-positions it on
      // its plan (moveRevolutionAxisCenterService). It cannot be turned here
      // — its own blue handles do that.
      const isRevolutionAxisMove =
        kind === "MOVE" && annotation.type === "REVOLUTION_AXIS";
      if (
        !isRevolutionAxisMove &&
        !isPointBasedAnnotationType(annotation.type)
      ) {
        dispatch(
          setToaster({
            message:
              kind === "MOVE"
                ? "Ce type d'annotation ne peut pas être déplacé ici (tracé à points requis)"
                : "Ce type d'annotation ne peut pas être tourné ici (tracé à points requis)",
            severity: "warning",
          })
        );
        return;
      }

      const carriedAnnotationIds = isRevolutionAxisMove
        ? [annotationId]
        : getCarriedAnnotationIdsFromSelection({
            grabbed: {
              annotationId,
              annotationType: annotation.type,
              listingId: annotation.listingId,
              annotationTemplateId: annotation.annotationTemplateId,
              baseMapId: annotation.baseMapId,
            },
            selectedItems,
            allAnnotations: annotationsRef.current,
            dispatch,
          });
      if (!carriedAnnotationIds.length) return;

      // Ownership / read-only: every carried annotation must be editable
      // (the check toasts on refusal).
      for (const id of carriedAnnotationIds) {
        if (!canEditAnnotation(id)) return;
      }

      const anchor = { x: snap.x, y: snap.y };
      setTransformSession({
        kind,
        carriedAnnotationIds,
        anchor,
        reference: null,
        cursor: anchor,
        rawCursor: anchor,
        meterByPx: baseMapRef.current?.getMeterByPx?.() ?? null,
        angleDeg: 0,
        angleBuffer: "",
        copyBuffer: "",
        committing: false,
      });
    },
    [dispatch, store, canEditAnnotation]
  );

  const commit = useCallback(
    async (transform) => {
      const session = getTransformSession();
      const annotationIds = session.carriedAnnotationIds;
      const currentBaseMap = baseMapRef.current;
      const imageSize =
        currentBaseMap?.getImageSize?.() || currentBaseMap?.image?.imageSize;
      // Keep the preview on the final pose until the db answers.
      setTransformSession({ committing: true });
      try {
        const axis =
          transform.kind === "MOVE" && annotationIds.length === 1
            ? annotationsRef.current?.find(
                (a) => a.id === annotationIds[0] && a.type === "REVOLUTION_AXIS"
              )
            : null;
        if (axis) {
          if (!imageSize?.width || !imageSize?.height)
            throw new Error("no image size");
          await moveRevolutionAxisCenterService({
            axisId: axis.id,
            deltaNormalized: {
              x: transform.deltaPx.x / imageSize.width,
              y: transform.deltaPx.y / imageSize.height,
            },
            dispatch,
          });
        } else if (
          transform.kind === "MOVE_COPY" ||
          transform.kind === "ROTATE_COPY"
        ) {
          await createTransformedAnnotationCopiesService({
            annotations: (annotationsRef.current ?? []).filter((a) =>
              annotationIds.includes(a.id)
            ),
            transform:
              transform.kind === "MOVE_COPY"
                ? { kind: "MOVE", deltaPx: transform.deltaPx }
                : {
                    kind: "ROTATE",
                    pivotPx: transform.pivotPx,
                    angleDeg: transform.angleDeg,
                  },
            count: transform.count,
            imageSize,
            projectId: projectIdRef.current,
            activeLayerId: store.getState().layers?.activeLayerId,
            dispatch,
          });
        } else {
          await commitAnnotationsTransform2d({
            annotationIds,
            allAnnotations: annotationsRef.current,
            transform,
            imageSize,
            meterByPx: currentBaseMap?.getMeterByPx?.(),
            projectId: projectIdRef.current,
            dispatch,
          });
        }
      } catch (err) {
        console.error("[annotationTransform] persist failed", err);
        dispatch(
          setToaster({
            message: "La transformation n'a pas pu être enregistrée",
            severity: "error",
          })
        );
        resetTransformSession();
        return;
      }
      setTimeout(() => {
        if (getTransformSession().committing) resetTransformSession();
      }, COMMIT_PREVIEW_FALLBACK_MS);
    },
    [dispatch, store]
  );

  const commitRotation = useCallback(() => {
    const session = getTransformSession();
    if (session.kind !== "ROTATE" || !session.reference || session.committing)
      return;
    if (Math.abs(session.angleDeg) < 1e-9) {
      resetTransformSession();
      return;
    }
    const copyCount = getTransformCopyCount(session);
    commit({
      kind: copyCount > 0 ? "ROTATE_COPY" : "ROTATE",
      pivotPx: session.anchor,
      angleDeg: session.angleDeg,
      ...(copyCount > 0 ? { count: copyCount } : {}),
    });
  }, [commit]);

  // handlers — called by InteractionLayer (positions in the pixel frame)

  const handleClick = useCallback(
    ({ mode, localPos, rawLocalPos, orthoAngleDeg, shiftKey, snap }) => {
      const session = getTransformSession();
      if (session.committing) return;
      // Move destination with Shift: ortho lock from the clicked point, the
      // snaps are ignored.
      const orthoLocked =
        shiftKey && session.kind === "MOVE" && mode === MOVE_ANNOTATION_MODE;
      const point = orthoLocked
        ? getOrthoConstrainedPoint({
            anchor: session.anchor,
            point: rawLocalPos ?? localPos,
            angleDeg: orthoAngleDeg,
          })
        : snap
          ? { x: snap.x, y: snap.y }
          : localPos;

      if (mode === MOVE_ANNOTATION_MODE) {
        if (session.kind !== "MOVE") {
          // Grab click: a point of an annotation only.
          if (!snap) return;
          grab("MOVE", snap);
          return;
        }
        // A typed distance rescales the anchor → click vector.
        const destination = constrainMoveCursor(session, point);
        const deltaPx = {
          x: destination.x - session.anchor.x,
          y: destination.y - session.anchor.y,
        };
        if (Math.hypot(deltaPx.x, deltaPx.y) < MIN_MOVE_PX) {
          resetTransformSession();
          return;
        }
        setTransformSession({ rawCursor: point, cursor: destination });
        const copyCount = getTransformCopyCount(session);
        commit(
          copyCount > 0
            ? { kind: "MOVE_COPY", deltaPx, count: copyCount }
            : { kind: "MOVE", deltaPx }
        );
        return;
      }

      if (mode === ROTATE_ANNOTATION_MODE) {
        if (session.kind !== "ROTATE") {
          // Pivot: a point of an annotation, or any point of the base map
          // when the annotations to turn are selected.
          grab("ROTATE", snap ?? { x: localPos.x, y: localPos.y });
          return;
        }
        if (!session.reference) {
          // The reference axis needs a direction.
          if (
            Math.hypot(point.x - session.anchor.x, point.y - session.anchor.y) <
            MIN_MOVE_PX
          )
            return;
          setTransformSession({ reference: point, cursor: point, angleDeg: 0 });
          return;
        }
        commitRotation();
      }
    },
    [grab, commit, commitRotation]
  );

  const handleMove = useCallback(
    ({ localPos, rawLocalPos, orthoAngleDeg, snap, shiftKey }) => {
      const session = getTransformSession();
      if (!session.kind || session.committing) return;
      const cursor =
        shiftKey && session.kind === "MOVE"
          ? getOrthoConstrainedPoint({
              anchor: session.anchor,
              point: rawLocalPos ?? localPos,
              angleDeg: orthoAngleDeg,
            })
          : snap
            ? { x: snap.x, y: snap.y }
            : localPos;

      if (session.kind === "ROTATE" && session.reference) {
        // A typed angle locks the pose: the mouse no longer drives it.
        if (session.angleBuffer !== "") return;
        const angleDeg = getRotatePixelAngleDeg({
          pivot: session.anchor,
          reference: session.reference,
          cursor,
          stepDeg: shiftKey ? ROTATE_SHIFT_STEP_DEG : 0,
        });
        setTransformSession({ cursor, angleDeg: angleDeg ?? session.angleDeg });
        return;
      }
      if (session.kind === "MOVE") {
        setMoveCursor(cursor);
        return;
      }
      setTransformSession({ cursor });
    },
    []
  );

  // effects

  // Leaving the tool (Escape, another tool, module switch) drops the session.
  useEffect(() => {
    if (!active) return undefined;
    return () => resetTransformSession();
  }, [active, enabledDrawingMode]);

  // Keyboard — capture phase, ahead of InteractionLayer's own listener: its
  // catch-all would feed the typed digits to the segment-length buffer, and
  // its Escape exits the tool at once.
  useEffect(() => {
    if (!active) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const session = getTransformSession();
      const editable = isEditableTarget(e.target);
      const rotating = session.kind === "ROTATE" && Boolean(session.reference);
      const moving = session.kind === "MOVE";
      const consume = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      if (e.key === "Escape") {
        if (session.committing) return consume();
        // Typed angle / copies → in-progress grab → (not consumed) exit the
        // tool.
        if (rotating && session.angleBuffer !== "") {
          // Back to the mouse-driven angle without copies (next mouse move
          // refreshes it).
          setTransformSession({ angleBuffer: "" });
          return consume();
        }
        if (moving && session.copyBuffer !== "") {
          setMoveCopyBuffer("");
          return consume();
        }
        if (session.kind) {
          resetTransformSession();
          return consume();
        }
        return undefined;
      }

      if (e.key === "Enter") {
        if (!rotating) return undefined;
        commitRotation();
        return consume();
      }

      // The helper's angle field owns its own typing.
      if (editable) return undefined;

      if (e.key === "Backspace") {
        if (rotating && session.angleBuffer !== "")
          setRotateAngleBuffer(session.angleBuffer.slice(0, -1));
        if (moving && session.copyBuffer !== "")
          setMoveCopyBuffer(session.copyBuffer.slice(0, -1));
        return consume();
      }

      // Typed distance (digits) / « copie multiple » (`*` then digits)
      // while a move is pending. A revolution axis is moved alone, never
      // copied.
      if (moving && /^[0-9.,*]$/.test(e.key)) {
        if (isRevolutionAxisCarried(session) && e.key === "*") {
          dispatch(
            setToaster({
              message: MULTI_COPY_UNSUPPORTED_MESSAGE,
              severity: "warning",
            })
          );
          return consume();
        }
        setMoveCopyBuffer(appendToMoveBuffer(session.copyBuffer, e.key));
        return consume();
      }

      // Typed angle (digits, a leading `-`) / « copie multiple » (`*` then
      // digits) while turning (3/3).
      if (/^[0-9.,;*-]$/.test(e.key)) {
        if (rotating)
          setRotateAngleBuffer(
            appendToRotateBuffer(session.angleBuffer, e.key)
          );
        // Outside 3/3 the digits are swallowed too: these tools have no
        // segment length to constrain.
        return consume();
      }
      return undefined;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [active, commitRotation, isRevolutionAxisCarried, dispatch]);

  return {
    onTransformToolClick: handleClick,
    onTransformToolMove: handleMove,
  };
}
