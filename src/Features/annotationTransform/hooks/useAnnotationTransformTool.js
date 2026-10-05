import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import { isPointBasedAnnotationType } from "Features/threedAnnotationMove/utils/annotationTransformTypes";
import getCarriedAnnotationIdsFromSelection from "Features/threedAnnotationMove/utils/getCarriedAnnotationIdsFromSelection";

import moveRevolutionAxisCenterService from "Features/revolutionAxes/services/moveRevolutionAxisCenterService";

import commitAnnotationsTransform2d from "../services/commitAnnotationsTransform2d";
import {
  getTransformSession,
  resetTransformSession,
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
  appendToAngleBuffer,
  getRotatePixelAngleDeg,
} from "../utils/rotateAngle";
import { TRANSFORM_UNSUPPORTED_GRAB_MESSAGE } from "../constants/transformToolStrings";

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
//   Déplacer: click a point of an annotation, click the destination.
//   Tourner: click the pivot on an annotation, click a point fixing the
//   reference axis, turn with the mouse (Shift: 15° steps) or type the angle,
//   click / Enter to validate.
// The grabbed annotation carries the whole selection when it belongs to it
// (getCarriedAnnotationIdsFromSelection — shared with the 3D tools).
// A revolution axis is moved alone, from its centre or one of the ends of its
// contour (not turned).
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

  const grab = useCallback(
    (kind, snap) => {
      const annotationId = snap?.annotationId ?? snap?.previewAnnotationId;
      const annotation = annotationId
        ? annotationsRef.current?.find((a) => a.id === annotationId)
        : null;
      if (!annotation || isForeignFootprintId(annotationId)) {
        dispatch(setToaster({ message: TRANSFORM_UNSUPPORTED_GRAB_MESSAGE }));
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
            selectedItems: store.getState().selection.selectedItems,
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
        angleDeg: 0,
        angleBuffer: "",
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
    [dispatch]
  );

  const commitRotation = useCallback(() => {
    const session = getTransformSession();
    if (session.kind !== "ROTATE" || !session.reference || session.committing)
      return;
    if (Math.abs(session.angleDeg) < 1e-9) {
      resetTransformSession();
      return;
    }
    commit({
      kind: "ROTATE",
      pivotPx: session.anchor,
      angleDeg: session.angleDeg,
    });
  }, [commit]);

  // handlers — called by InteractionLayer (positions in the pixel frame)

  const handleClick = useCallback(
    ({ mode, localPos, snap }) => {
      const session = getTransformSession();
      if (session.committing) return;
      const point = snap ? { x: snap.x, y: snap.y } : localPos;

      if (mode === MOVE_ANNOTATION_MODE) {
        if (session.kind !== "MOVE") {
          // Grab click: a point of an annotation only.
          if (!snap) return;
          grab("MOVE", snap);
          return;
        }
        const deltaPx = {
          x: point.x - session.anchor.x,
          y: point.y - session.anchor.y,
        };
        if (Math.hypot(deltaPx.x, deltaPx.y) < MIN_MOVE_PX) {
          resetTransformSession();
          return;
        }
        setTransformSession({ cursor: point });
        commit({ kind: "MOVE", deltaPx });
        return;
      }

      if (mode === ROTATE_ANNOTATION_MODE) {
        if (session.kind !== "ROTATE") {
          if (!snap) return;
          grab("ROTATE", snap);
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

  const handleMove = useCallback(({ localPos, snap, shiftKey }) => {
    const session = getTransformSession();
    if (!session.kind || session.committing) return;
    const cursor = snap ? { x: snap.x, y: snap.y } : localPos;

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
    setTransformSession({ cursor });
  }, []);

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
      const consume = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      if (e.key === "Escape") {
        if (session.committing) return consume();
        // Typed angle → in-progress grab → (not consumed) exit the tool.
        if (rotating && session.angleBuffer !== "") {
          // Back to the mouse-driven angle (next mouse move refreshes it).
          setTransformSession({ angleBuffer: "" });
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
        return consume();
      }

      if (/^[0-9.,;-]$/.test(e.key)) {
        if (rotating)
          setRotateAngleBuffer(appendToAngleBuffer(session.angleBuffer, e.key));
        // Outside 3/3 the digits are swallowed too: these tools have no
        // segment length to constrain.
        return consume();
      }
      return undefined;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [active, commitRotation]);

  return {
    onTransformToolClick: handleClick,
    onTransformToolMove: handleMove,
  };
}
