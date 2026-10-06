import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";
import {
  clearRevolutionAxisDraft,
  setRevolutionAxisDrawCenter,
} from "Features/threedEditor/threedEditorSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";

import commitDrawnRevolutionAxisService from "../services/commitDrawnRevolutionAxisService";
import { getLastRevolutionAxisHit } from "../state/lastRevolutionAxisHitStore";

// Pointer movement (CSS px) above which a press-release pair is a camera drag,
// not a click. Mirrors useDimensionPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Click + key handlers of the 3D revolution axis draw (two clicks on a
// HORIZONTAL base map plane, see RevolutionAxisDraftOverlayThreed for the
// hover hit). First click = centre; second click = radius + diameter
// direction → commitDrawnRevolutionAxisService, then the tool disarms
// (one-shot, like the 2D REVOLUTION_AXIS_PLAN tool): clearing the 2D drawing
// state makes useRevolutionAxisDrawThreedBridge close the 3D mode. Esc drops
// the pending centre, or exits the tool when nothing is in progress.
export default function useRevolutionAxisDrawThreedPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector(
    (s) => s.threedEditor.revolutionAxisDrawMode.active
  );
  const centerPoint = useSelector(
    (s) => s.threedEditor.revolutionAxisDrawMode.centerPoint
  );
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMaps = useBaseMaps()?.value;
  const createAnnotation = useCreateAnnotation();

  const newAnnotationRef = useRef(newAnnotation);
  useEffect(() => {
    newAnnotationRef.current = newAnnotation;
  }, [newAnnotation]);
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

    function exitTool() {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
    }

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

      const hit = getLastRevolutionAxisHit();
      if (!hit?.position || !hit.baseMapId) return; // plane hits only

      const point = {
        x: hit.position.x,
        y: hit.position.y,
        z: hit.position.z,
        baseMapId: hit.baseMapId,
      };

      if (!centerPoint) {
        if (!scopeId) {
          dispatch(
            setToaster({
              message: "Sélectionnez un scope avant de dessiner un axe",
              severity: "warning",
            })
          );
          return;
        }
        dispatch(setRevolutionAxisDrawCenter(point));
        return;
      }

      const host = (baseMaps ?? []).find(
        (bm) => bm.id === centerPoint.baseMapId
      );
      try {
        const created = await commitDrawnRevolutionAxisService({
          center: centerPoint,
          edge: point,
          host,
          projectId,
          scopeId,
          draft: newAnnotationRef.current,
          layerId: activeLayerIdRef.current ?? null,
          createAnnotationFn: createAnnotation,
        });
        if (!created) {
          console.warn("[revolutionAxes] 3D axis commit refused", {
            hostId: centerPoint.baseMapId,
          });
        }
      } catch (err) {
        console.error("[revolutionAxes] 3D axis commit failed", err);
      }
      dispatch(clearRevolutionAxisDraft());
      // One-shot tool (2D parity): the bridge closes the 3D mode.
      exitTool();
    }

    function onPointerCancel() {
      downPosRef.current = null;
      isDraggingRef.current = false;
    }

    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (centerPoint) dispatch(clearRevolutionAxisDraft());
      else exitTool();
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
    centerPoint,
    baseMaps,
    projectId,
    scopeId,
    createAnnotation,
    dispatch,
  ]);
}
