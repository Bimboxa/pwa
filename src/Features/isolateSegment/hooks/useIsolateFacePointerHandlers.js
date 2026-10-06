import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Raycaster, Vector2 } from "three";

import {
  bumpSnapIndexEpoch,
  setIsolateFaceModeActive,
} from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";
import {
  getFaceRegion,
  buildFaceHoverOverlay,
  disposeFaceHoverOverlay,
} from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";

import isolateSegmentService from "../services/isolateSegmentService";
import {
  ISOLATE_SEGMENT_DONE_MESSAGE,
  ISOLATE_SEGMENT_READ_ONLY_MESSAGE,
  getIsolateSegmentRefusedMessage,
} from "../utils/isolateSegmentMessages";
import locateSegmentOnAnnotation3d from "../utils/locateSegmentOnAnnotation3d";
import selectIsolatedAnnotation from "../utils/selectIsolatedAnnotation";

// Mirrors useExtrudePointerHandlers: a pointer travelling farther is a camera
// orbit, not a click.
const DRAG_THRESHOLD_PX = 4;

const ISOLABLE_TYPES = ["POLYLINE", "STRIP"];

// « Isoler une face » (3D editor of the Dessin module,
// threedEditor.isolateFaceMode): the face under the cursor is stippled; a
// click on a face of a POLYLINE / STRIP wall (side, top, end cap) isolates
// the segment that face belongs to — located in plan
// (locateSegmentOnAnnotation3d) — through isolateSegmentService, the same
// writer as the 2D « Isoler un segment ». The tool stays armed; Escape
// leaves it. `annotations`: the resolved list loaded in the 3D editor
// (permissions).
export default function useIsolateFacePointerHandlers({ annotations }) {
  const dispatch = useDispatch();

  // data

  const active = useSelector((s) => s.threedEditor.isolateFaceMode.active);
  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const faceSelectionAngleDeg = useSelector(
    (s) => s.threedEditor.faceSelectionAngleDeg
  );
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const { isReadOnly: isReadOnlyScope } = useReadOnlyScope();
  const { canEditAnnotation } = useAnnotationPermissions({ annotations });

  // state — refs so the pointer effect never re-attaches mid-gesture

  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const faceSelectionAngleDegRef = useRef(faceSelectionAngleDeg);
  faceSelectionAngleDegRef.current = faceSelectionAngleDeg;
  const isReadOnlyScopeRef = useRef(isReadOnlyScope);
  isReadOnlyScopeRef.current = isReadOnlyScope;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const createAnnotationRef = useRef(createAnnotation);
  createAnnotationRef.current = createAnnotation;
  const updateAnnotationRef = useRef(updateAnnotation);
  updateAnnotationRef.current = updateAnnotation;

  // MAP-module-only mode: force-deactivate on module switch.
  useEffect(() => {
    if (active && moduleKey !== "MAP") {
      dispatch(setIsolateFaceModeActive(false));
    }
  }, [active, moduleKey, dispatch]);

  useEffect(() => {
    if (!active) return undefined;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!dom) return undefined;

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    const hover = { overlay: null, key: null };
    let downPos = null;
    let dragging = false;
    let lastEvent = null;
    let rafId = null;
    let busy = false;
    let disposed = false;

    const toast = (message, isError = true) =>
      dispatch(setToaster({ message, isError }));

    // The wall / band face under the pointer: { nodeId, hitObject,
    // intersect } or null.
    function pickScene(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, sceneManager.camera);
      const clippingPlane = getActiveClippingPlane(sceneManager);

      const targets = [];
      sceneManager.scene.traverse((obj) => {
        if (obj.isMesh && !obj.isLine2 && !obj.isLineSegments2) {
          targets.push(obj);
        }
      });
      const intersects = filterIntersectionsByVisibility(
        filterIntersectionsByClipping(
          raycaster.intersectObjects(targets, false),
          clippingPlane
        )
      );

      for (const intersect of intersects) {
        let object = intersect.object;
        while (object) {
          if (object.userData?.nodeId) {
            const { nodeId, nodeType, annotationType, isAnnotationMesh3d } =
              object.userData;
            if (
              nodeType !== "ANNOTATION" ||
              isAnnotationMesh3d ||
              !ISOLABLE_TYPES.includes(annotationType) ||
              isForeignFootprintId(nodeId)
            ) {
              return null;
            }
            return { nodeId, hitObject: intersect.object, intersect };
          }
          object = object.parent;
        }
        return null;
      }
      return null;
    }

    function clearStipple() {
      if (!hover.overlay) return;
      disposeFaceHoverOverlay(hover.overlay);
      hover.overlay = null;
      hover.key = null;
      sceneManager.renderScene?.();
    }

    // Same stipple as the selection-mode hover (extrude tool), so the face
    // about to be isolated is obvious before clicking.
    function applyStipple(object, faceIndex) {
      const angleDeg = faceSelectionAngleDegRef.current;
      const region = getFaceRegion(object.geometry, faceIndex, {
        plane: !!object.userData?.hasSubtraction,
        angleDeg,
      });
      const key = region
        ? `${object.uuid}:${angleDeg}:${region.regionId}`
        : null;
      if (key === hover.key) return;
      disposeFaceHoverOverlay(hover.overlay);
      hover.overlay = null;
      if (region) {
        const overlay = buildFaceHoverOverlay(object, region.tris);
        if (overlay) {
          object.add(overlay);
          hover.overlay = overlay;
        }
      }
      hover.key = key;
      sceneManager.renderScene?.();
    }

    function runHover() {
      rafId = null;
      const e = lastEvent;
      if (!e || disposed) return;
      const pick = pickScene(e);
      if (pick) {
        applyStipple(pick.hitObject, pick.intersect.faceIndex);
        dom.style.cursor = "pointer";
      } else {
        clearStipple();
        dom.style.cursor = "default";
      }
    }

    async function isolateAt(pick) {
      if (busy) return;
      const annotationId = pick.nodeId;
      if (isReadOnlyScopeRef.current) {
        toast(ISOLATE_SEGMENT_READ_ONLY_MESSAGE);
        return;
      }
      if (!canEditAnnotation(annotationId)) return; // self-toasting

      busy = true;
      try {
        const annotation = await db.annotations.get(annotationId);
        if (!annotation) {
          toast("Annotation introuvable");
          return;
        }
        const located = await locateSegmentOnAnnotation3d({
          editor,
          annotation,
          worldPoint: pick.intersect.point,
        });
        if (!located) {
          toast("Cliquez une face d'un mur ou d'une bande");
          return;
        }
        const baseMapRecord =
          sceneManager.imagesManager?.baseMapsMap?.[annotation.baseMapId];
        const metrics = getBaseMapForRender(baseMapRecord);
        const result = await isolateSegmentService({
          annotation,
          segmentStartPointId: located.segmentStartPointId,
          projectId: projectIdRef.current,
          imageSize: metrics
            ? { width: metrics.imageWidth, height: metrics.imageHeight }
            : null,
          meterByPx: metrics?.meterByPx,
          createAnnotationFn: createAnnotationRef.current,
          updateAnnotationFn: updateAnnotationRef.current,
        });
        if (disposed) return;
        if (result.status !== "done") {
          toast(getIsolateSegmentRefusedMessage(result.reason));
          return;
        }
        clearStipple();
        dispatch(bumpSnapIndexEpoch());
        selectIsolatedAnnotation(dispatch, {
          id: result.isolatedId,
          type: annotation.type,
          listingId: annotation.listingId,
          annotationTemplateId: annotation.annotationTemplateId,
        });
        toast(ISOLATE_SEGMENT_DONE_MESSAGE, false);
      } finally {
        busy = false;
      }
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      dragging = false;
    }

    function onPointerMove(e) {
      lastEvent = e;
      if (rafId == null) rafId = requestAnimationFrame(runHover);
      if (!downPos) return;
      const dx = Math.abs(e.clientX - downPos.x);
      const dy = Math.abs(e.clientY - downPos.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) dragging = true;
    }

    function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = dragging;
      downPos = null;
      dragging = false;
      if (wasDrag) return; // camera orbit, not a click
      const pick = pickScene(e);
      if (pick) isolateAt(pick);
    }

    function onPointerCancel() {
      downPos = null;
      dragging = false;
    }

    function onPointerLeave() {
      lastEvent = null;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      clearStipple();
    }

    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") dispatch(setIsolateFaceModeActive(false));
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      disposed = true;
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown, true);
      if (rafId != null) cancelAnimationFrame(rafId);
      clearStipple();
      dom.style.cursor = "default";
    };
  }, [active, dispatch, canEditAnnotation]);
}
