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
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useNewEntity from "Features/entities/hooks/useNewEntity";

import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools";

import commitDrawnFaceService from "../services/commitDrawnFaceService";
import commitDrawnPolylineService from "../services/commitDrawnPolylineService";
import { getLastSnap } from "../services/lastSnapStore";
import computeRectangleCorners from "../utils/computeRectangleCorners";
import detectClosedFace from "../utils/detectClosedFace";
import resolveBaseMapForPoint from "../utils/resolveBaseMapForPoint";

// Pointer movement (in CSS px) above which a press-release pair is treated as
// a camera drag and NOT as a vertex commit. Mirrors the threshold used by
// MainThreedEditor's selection click vs lasso disambiguation.
const DRAG_THRESHOLD_PX = 4;

// Wires click + key handlers for the 3D drawing mode. A vertex is committed
// on pointerup only when the pointer hasn't moved past `DRAG_THRESHOLD_PX`
// since pointerdown — drags belong to OrbitControls. If the resulting
// segment closes a coplanar face, the face is auto-committed (3D → 2D
// annotation).
//
// Keys mirror the 2D editor: Enter — and Escape with points in progress —
// commit the drawing as an annotation when a template is armed (open
// POLYLINE, or POLYGON with 3+ points); Escape with nothing exits the tool.
// Without a template, Enter keeps its historical behavior of flushing the
// polyline as a persistent wireframe trait.
//
// RECTANGLE-behavior tools get their own two-click flow: first click anchors
// on a base map plane, second click commits the axis-aligned rectangle.
export default function useDrawingPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.drawingMode.active);
  const inProgressPolyline = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline
  );
  const trait3DSegments = useSelector(
    (s) => s.threedEditor.drawingMode.trait3DSegments
  );
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const baseMaps = useBaseMaps()?.value;
  const mainBaseMapId = useMainBaseMap()?.id;

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

    const behavior = getDrawingToolByKey(enabledDrawingMode)?.behavior;

    function hasTemplate() {
      const na = newAnnotationRef.current;
      return Boolean(
        na?.annotationTemplateId &&
        (na?.type === "POLYGON" || na?.type === "POLYLINE")
      );
    }

    // Entity parity with the 2D commit (useHandleCommitDrawing): free
    // annotations are backed by a hidden system template and carry no entity.
    async function createEntityForCommit() {
      const na = newAnnotationRef.current;
      if (na.isFreeAnnotation) return null;
      const entity = await createEntity(newEntityRef.current);
      return entity?.id ?? null;
    }

    async function commitFace(cornersInOrder) {
      const entityId = await createEntityForCommit();
      return await commitDrawnFaceService({
        cornersInOrder,
        baseMaps: baseMaps || [],
        projectId,
        listingId,
        templateProps: newAnnotationRef.current,
        entityId,
        layerId: activeLayerIdRef.current ?? null,
        createAnnotationFn: createAnnotation,
      });
    }

    async function commitPolyline(verticesInOrder, { closeLine = false } = {}) {
      const entityId = await createEntityForCommit();
      return await commitDrawnPolylineService({
        verticesInOrder,
        baseMaps: baseMaps || [],
        projectId,
        listingId,
        templateProps: newAnnotationRef.current,
        entityId,
        layerId: activeLayerIdRef.current ?? null,
        createAnnotationFn: createAnnotation,
        closeLine,
      });
    }

    function warnIfOffMainBaseMap(created) {
      if (!created || !mainBaseMapId || created.baseMapId === mainBaseMapId)
        return;
      console.warn(
        `[threedDrawing] annotation ${created.id} committed on base map ${created.baseMapId}, which is NOT the 2D-selected one (${mainBaseMapId}) — select that base map in 2D to see it`
      );
    }

    function finishCommit() {
      dispatch(cancelInProgressPolyline());
      // Schedule a snap-index rebuild so the freshly-created annotation's
      // vertices/edges become snappable. Delay lets the db → liveQuery →
      // AnnotationsManager pipeline add the new mesh to the scene before we
      // re-traverse it.
      setTimeout(() => dispatch(bumpSnapIndexEpoch()), 350);
    }

    // Enter/Escape commit of the in-progress polyline (2D parity): POLYGON
    // templates need 3+ points and go through the face classification;
    // POLYLINE templates commit as an OPEN polyline from 2 points.
    async function commitInProgressAsAnnotation() {
      if (!hasTemplate()) {
        console.warn(
          "[threedDrawing] key commit skipped: no armed POLYGON/POLYLINE template"
        );
        return false;
      }
      const na = newAnnotationRef.current;
      const pts = inProgressPolyline;
      try {
        let created = null;
        if (na.type === "POLYGON" && pts.length >= 3) {
          created = await commitFace(pts);
        } else if (na.type === "POLYLINE" && pts.length >= 2) {
          created = await commitPolyline(pts);
        } else {
          console.warn(
            `[threedDrawing] key commit skipped: ${na.type} needs ${
              na.type === "POLYGON" ? 3 : 2
            }+ points (got ${pts.length})`
          );
        }
        if (created) {
          console.log(
            `[threedDrawing] annotation created: ${created.id} on baseMap ${created.baseMapId} (listing ${created.listingId})`
          );
          warnIfOffMainBaseMap(created);
          finishCommit();
          return true;
        }
      } catch (err) {
        console.error("[threedDrawing] drawing commit failed", err);
      }
      return false;
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

      const snap = getLastSnap();
      // One decision line per click so a "nothing happened" report pinpoints
      // the exit taken (temporary diagnostics while the feature stabilizes).
      console.log("[threedDrawing] click", {
        snapKind: snap?.kind ?? null,
        snapBaseMapId: snap?.baseMapId ?? null,
        mainBaseMapId: mainBaseMapId ?? null,
        behavior: behavior ?? null,
        hasTemplate: hasTemplate(),
        type: newAnnotationRef.current?.type ?? null,
        points: inProgressPolyline.length,
        baseMapsCount: baseMaps?.length ?? 0,
      });
      if (!snap?.position) {
        console.warn("[threedDrawing] click ignored: no snap under cursor");
        return;
      }

      if (behavior === "RECTANGLE" && hasTemplate()) {
        if (inProgressPolyline.length === 0) {
          // The anchor must resolve to a base map plane — the rectangle is
          // axis-aligned in that image's frame.
          let baseMapId = snap.baseMapId ?? null;
          if (!baseMapId) {
            baseMapId =
              resolveBaseMapForPoint(snap.position, baseMaps || [])?.baseMap
                ?.id ?? null;
          }
          if (!baseMapId) {
            console.warn(
              "[threedDrawing] rectangle anchor ignored: not on a base map plane"
            );
            return;
          }
          dispatch(
            pushDrawingVertex({
              x: snap.position.x,
              y: snap.position.y,
              z: snap.position.z,
              meshKey: snap.meshKey,
              snapKind: snap.kind,
              baseMapId,
            })
          );
          return;
        }
        // Second click: auto-commit the 4 corners (2D parity — the RECTANGLE
        // behavior never falls through to face detection).
        const anchor = inProgressPolyline[0];
        const host = (baseMaps || []).find((b) => b.id === anchor.baseMapId);
        if (!host) {
          console.warn(
            `[threedDrawing] rectangle cancelled: anchor base map ${anchor.baseMapId} not found`
          );
          dispatch(cancelInProgressPolyline());
          return;
        }
        const corners = computeRectangleCorners(anchor, snap.position, host);
        if (!corners) {
          console.warn(
            "[threedDrawing] rectangle 2nd click ignored: degenerate corners"
          );
          return; // stay armed
        }
        const na = newAnnotationRef.current;
        const vertices = corners.map((c) => ({
          x: c.x,
          y: c.y,
          z: c.z,
          baseMapId: host.id,
        }));
        try {
          const created =
            na.type === "POLYGON"
              ? await commitFace(vertices)
              : await commitPolyline(vertices, { closeLine: true });
          if (created) {
            console.log(
              `[threedDrawing] rectangle annotation created: ${created.id} on baseMap ${created.baseMapId} (listing ${created.listingId})`
            );
            warnIfOffMainBaseMap(created);
            finishCommit();
          } else {
            console.warn(
              "[threedDrawing] rectangle commit returned null (see abort reason above)"
            );
          }
        } catch (err) {
          console.error("[threedDrawing] rectangle commit failed", err);
        }
        return;
      }

      const newVertex = {
        x: snap.position.x,
        y: snap.position.y,
        z: snap.position.z,
        meshKey: snap.meshKey,
        snapKind: snap.kind,
        ...(snap.baseMapId ? { baseMapId: snap.baseMapId } : {}),
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

      // The mode is only ever armed by a template row click (via
      // useTemplateFaceDrawBridge), so a missing template means the state is
      // stale — keep drawing, but commit nothing.
      if (detectedFaces.length > 0 && hasTemplate()) {
        try {
          // Several closures (e.g. a notch diagonal closing both the floor
          // triangle and the wall rectangle) all commit — one annotation
          // (and entity) per face; the user deletes the unwanted one.
          let committedAny = false;
          const consumed = [];
          for (const face of detectedFaces) {
            const created = await commitFace(face.cornersInOrder);
            if (created) {
              console.log(
                `[threedDrawing] face annotation created: ${created.id} on baseMap ${created.baseMapId} (listing ${created.listingId})`
              );
              warnIfOffMainBaseMap(created);
              committedAny = true;
              consumed.push(...face.consumedSegments);
            }
          }
          if (committedAny) {
            dispatch(consumeFaceSegments(consumed));
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

    async function onKeyDown(e) {
      if (["INPUT", "TEXTAREA"].includes(e.target?.tagName)) return;
      if (e.key === "Enter") {
        // Rectangle: keys never commit (2D parity — the 2nd click does).
        if (behavior === "RECTANGLE") return;
        const committed = await commitInProgressAsAnnotation();
        if (!committed) dispatch(flushInProgressAsTrait3D());
      } else if (e.key === "Escape") {
        if (inProgressPolyline.length > 0) {
          if (behavior === "RECTANGLE") {
            dispatch(cancelInProgressPolyline());
            return;
          }
          // 2D parity: Escape mid-drawing commits too; an uncommittable
          // polyline (too few points, no template...) is discarded instead.
          const committed = await commitInProgressAsAnnotation();
          if (!committed) dispatch(cancelInProgressPolyline());
          return;
        }
        const na = newAnnotationRef.current;
        if (na?.annotationTemplateId) {
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
    mainBaseMapId,
    projectId,
    listingId,
    enabledDrawingMode,
    dispatch,
  ]);
}
