import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  clearDimensionDraft,
  setDimensionStartPoint,
} from "Features/threedEditor/threedEditorSlice";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useNewEntity from "Features/entities/hooks/useNewEntity";

import commitDrawnCoteService from "Features/threedDrawing/services/commitDrawnCoteService";

import { getLastDimensionSnap } from "../services/lastDimensionSnapStore";

// Pointer movement (in CSS px) above which a press-release pair is treated as
// a camera drag and NOT as a point commit. Mirrors useDrawingPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Wires click + key handlers for the template-driven cote (2-click) mode. A
// point is committed on pointerup only when (a) the pointer hasn't moved past
// DRAG_THRESHOLD_PX and (b) the cursor is snapped to a mesh vertex/segment.
// First commit sets the start point; second commit converts the 3D segment
// into a standard COTE annotation (commitDrawnCoteService) and resets the
// draft — the mode stays active so cotes can be chained. Esc cancels the
// in-progress draft, or exits the mode entirely when nothing is in progress.
export default function useDimensionPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.dimensionMode.active);
  const startPoint = useSelector(
    (s) => s.threedEditor.dimensionMode.startPoint
  );

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const baseMaps = useBaseMaps()?.value;

  // Template-driven mode (see useTemplateCoteDrawBridge): the committed cote
  // carries the armed template + entity + layer.
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

      const snap = getLastDimensionSnap();
      if (!snap?.position) return; // snap-to-mesh only — ignore free clicks

      const point = {
        x: snap.position.x,
        y: snap.position.y,
        z: snap.position.z,
      };

      if (!startPoint) {
        dispatch(setDimensionStartPoint(point));
        return;
      }

      try {
        const na = newAnnotationRef.current;
        const hasTemplate = Boolean(
          na?.annotationTemplateId && na?.type === "COTE"
        );
        // Entity parity with the 2D commit (useHandleCommitDrawing): free
        // annotations carry no entity.
        let entityId = null;
        if (hasTemplate && !na.isFreeAnnotation) {
          const entity = await createEntity(newEntityRef.current);
          entityId = entity?.id ?? null;
        }
        await commitDrawnCoteService({
          a: startPoint,
          b: point,
          baseMaps: baseMaps || [],
          projectId,
          listingId,
          templateProps: hasTemplate ? na : null,
          entityId,
          layerId: hasTemplate ? (activeLayerIdRef.current ?? null) : null,
          createAnnotationFn: hasTemplate ? createAnnotation : null,
        });
      } catch (err) {
        console.error("[threedDimensions] cote commit failed", err);
      }
      dispatch(clearDimensionDraft());
    }

    function onPointerCancel() {
      downPosRef.current = null;
      isDraggingRef.current = false;
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        const na = newAnnotationRef.current;
        if (!startPoint && na?.annotationTemplateId) {
          // Template-driven mode, nothing in progress: exit entirely by
          // clearing the 2D drawing state (the bridge deactivates the mode).
          dispatch(setEnabledDrawingMode(null));
          dispatch(setNewAnnotation({}));
        } else {
          dispatch(clearDimensionDraft());
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
    startPoint,
    baseMaps,
    projectId,
    listingId,
    createAnnotation,
    createEntity,
    dispatch,
  ]);
}
