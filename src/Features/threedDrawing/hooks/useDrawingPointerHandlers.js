import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  bumpSnapIndexEpoch,
  cancelInProgressPolyline,
  consumeFaceSegments,
  flushInProgressAsTrait3D,
  pushDrawingVertex,
} from "Features/threedEditor/threedEditorSlice";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useNewEntity from "Features/entities/hooks/useNewEntity";

import commitDrawnFaceService from "../services/commitDrawnFaceService";
import { getLastSnap } from "../services/lastSnapStore";
import detectClosedFace from "../utils/detectClosedFace";

// Pointer movement (in CSS px) above which a press-release pair is treated as
// a camera drag and NOT as a vertex commit. Mirrors the threshold used by
// MainThreedEditor's selection click vs lasso disambiguation.
const DRAG_THRESHOLD_PX = 4;

// Wires click + key handlers for the 3D drawing mode. A vertex is committed
// on pointerup only when the pointer hasn't moved past `DRAG_THRESHOLD_PX`
// since pointerdown — drags belong to OrbitControls. If the resulting
// segment closes a coplanar face, the face is auto-committed (3D → 2D
// annotation). Enter flushes the in-progress polyline as a persistent
// wireframe trait. Esc cancels it.
export default function useDrawingPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.drawingMode.active);
  const inProgressPolyline = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline
  );
  const trait3DSegments = useSelector(
    (s) => s.threedEditor.drawingMode.trait3DSegments
  );

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const baseMaps = useBaseMaps()?.value;

  // Template-driven mode (see useTemplateFaceDrawBridge): the committed face
  // carries the armed template + entity + layer instead of isPendingTemplate.
  const createAnnotation = useCreateAnnotation();
  const createEntity = useCreateEntity();
  const newEntity = useNewEntity();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const newAnnotationRef = useRef(newAnnotation);
  useEffect(() => {
    newAnnotationRef.current = newAnnotation;
  }, [newAnnotation]);
  const newEntityRef = useRef(newEntity);
  useEffect(() => {
    newEntityRef.current = newEntity;
  }, [newEntity]);
  const activeLayerIdRef = useRef(activeLayerId);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  const downPosRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    if (!dom) return;

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPosRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
    }

    function onPointerMove(e) {
      if (!downPosRef.current) return;
      const dx = Math.abs(e.clientX - downPosRef.current.x);
      const dy = Math.abs(e.clientY - downPosRef.current.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true;
      }
    }

    async function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = isDraggingRef.current;
      downPosRef.current = null;
      isDraggingRef.current = false;
      if (wasDrag) return;

      const snap = getLastSnap();
      if (!snap?.position) return;

      const newVertex = {
        x: snap.position.x,
        y: snap.position.y,
        z: snap.position.z,
        meshKey: snap.meshKey,
      };
      const nextPolyline = [...inProgressPolyline, newVertex];

      let detectedFaces = [];
      if (nextPolyline.length >= 2) {
        const inProgressSegments = [];
        for (let i = 0; i < nextPolyline.length - 1; i++) {
          inProgressSegments.push({
            a: nextPolyline[i],
            b: nextPolyline[i + 1],
          });
        }
        const allSegments = [...trait3DSegments, ...inProgressSegments];
        const lastIdx = allSegments.length - 1;
        detectedFaces = detectClosedFace(allSegments, lastIdx);
      }

      if (detectedFaces.length > 0) {
        try {
          const na = newAnnotationRef.current;
          const hasTemplate = Boolean(
            na?.annotationTemplateId &&
              (na?.type === "POLYGON" || na?.type === "POLYLINE")
          );
          // Several closures (e.g. a notch diagonal closing both the floor
          // triangle and the wall rectangle) all commit — one annotation
          // (and entity) per face; the user deletes the unwanted one.
          let committedAny = false;
          const consumed = [];
          for (const face of detectedFaces) {
            // Entity parity with the 2D commit (useHandleCommitDrawing):
            // free annotations are backed by a hidden system template and
            // carry no entity.
            let entityId = null;
            if (hasTemplate && !na.isFreeAnnotation) {
              const entity = await createEntity(newEntityRef.current);
              entityId = entity?.id ?? null;
            }
            const created = await commitDrawnFaceService({
              cornersInOrder: face.cornersInOrder,
              baseMaps: baseMaps || [],
              projectId,
              listingId,
              templateProps: hasTemplate ? na : null,
              entityId,
              layerId: hasTemplate ? (activeLayerIdRef.current ?? null) : null,
              createAnnotationFn: hasTemplate ? createAnnotation : null,
            });
            if (created) {
              committedAny = true;
              consumed.push(...face.consumedSegments);
            }
          }
          if (committedAny) {
            dispatch(consumeFaceSegments(consumed));
            // Schedule a snap-index rebuild so the freshly-created
            // annotation's vertices/edges become snappable. Delay lets the
            // db → liveQuery → AnnotationsManager pipeline add the new
            // mesh to the scene before we re-traverse it.
            setTimeout(() => dispatch(bumpSnapIndexEpoch()), 350);
            return;
          }
        } catch (err) {
          console.error("[threedDrawing] face commit failed", err);
        }
      }
      dispatch(pushDrawingVertex(newVertex));
    }

    function onPointerCancel() {
      downPosRef.current = null;
      isDraggingRef.current = false;
    }

    function onKeyDown(e) {
      if (e.key === "Enter") {
        dispatch(flushInProgressAsTrait3D());
      } else if (e.key === "Escape") {
        const na = newAnnotationRef.current;
        if (inProgressPolyline.length === 0 && na?.annotationTemplateId) {
          // Template-driven mode, nothing in progress: exit entirely by
          // clearing the 2D drawing state (the bridge deactivates the mode).
          dispatch(setEnabledDrawingMode(null));
          dispatch(setNewAnnotation({}));
        } else {
          dispatch(cancelInProgressPolyline());
        }
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
    };
  }, [
    active,
    inProgressPolyline,
    trait3DSegments,
    baseMaps,
    projectId,
    listingId,
    dispatch,
  ]);
}
