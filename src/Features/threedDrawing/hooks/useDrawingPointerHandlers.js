import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setToaster } from "Features/layout/layoutSlice";
import {
  appendToConstraintBuffer,
  appendToRectXBuffer,
  appendToRectYBuffer,
  clearConstraintBuffer,
  clearRectDims,
  deleteLastConstraintBuffer,
  deleteLastRectXBuffer,
  deleteLastRectYBuffer,
  setEnabledDrawingMode,
  setRectCurrentAxis,
  setRectHasFirstPoint,
  setRectXBuffer,
  setRectYBuffer,
  toggleRectXBufferSign,
  toggleRectYBufferSign,
} from "Features/mapEditor/mapEditorSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  bumpSnapIndexEpoch,
  cancelInProgressPolyline,
  consumeFaceSegments,
  flushInProgressAsTrait3D,
  pushDrawingVertex,
  toggleFaceCutSide,
} from "Features/threedEditor/threedEditorSlice";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools";
import parseRectBuffer from "Features/mapEditor/utils/parseRectBuffer";

import createFlatMesh3dAnnotationService from "Features/annotationMesh3d/services/createFlatMesh3dAnnotationService";
import cutFaceAlongPathService from "Features/threedFaceCut/services/cutFaceAlongPathService";
import {
  clearFaceCutHoverCache,
  getFaceCutAxisHover,
} from "Features/threedFaceCut/services/faceCutAxisStore";
import {
  getFaceCutAxis,
  isFaceCutDrawingMode,
} from "Features/threedFaceCut/utils/faceCutTools";
import getFaceCutBasisWorld from "Features/threedFaceCut/utils/getFaceCutBasisWorld";
import { isMeshBrushDrawingMode } from "Features/meshPaint/utils/meshBrushTools";

import commitDrawnFaceService, {
  FACE_COMMIT_NO_2D_ENCODING,
  commitDrawnFace,
} from "../services/commitDrawnFaceService";
import commitDrawnPolylineService, {
  POLYLINE_COMMIT_NO_2D_ENCODING,
  commitDrawnPolyline,
} from "../services/commitDrawnPolylineService";
import { getLastSnap } from "../services/lastSnapStore";
import computeRectangleCorners from "../utils/computeRectangleCorners";
import computeRectangleCornersOnPlane from "../utils/computeRectangleCornersOnPlane";
import detectClosedFace from "../utils/detectClosedFace";
import resolveBaseMapForPoint from "../utils/resolveBaseMapForPoint";
import { isTemplatelessDraft } from "../utils/templateFaceDrawSelectors";

// Pointer movement (in CSS px) above which a press-release pair is treated as
// a camera drag and NOT as a vertex commit. Mirrors the threshold used by
// MainThreedEditor's selection click vs lasso disambiguation.
const DRAG_THRESHOLD_PX = 4;

// Two drawn points closer than this (m) are the same point.
const SAME_POINT_EPS_M = 1e-4;

// Two clicks on one point within this delay (ms) are a double click.
const DOUBLE_CLICK_MS = 500;

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
//
// Template-less "Dessin" tool (isTemplatelessDraft) — like the 2D tool, the
// drawn shape becomes a template-less annotation of the scope: a POLYLINE
// (Enter, double click, Escape, the 2nd click of "Segment (2 clics)"; closed
// when clicked back on its first point) or a POLYGON (back on its first
// point, Enter, double click), encoded on its plan like a template face
// (commitDrawnFace) — a flat mesh sheet only when it has no plan encoding.
// It never cuts the faces it is drawn on.
//
// "Coupe face" tool (FACE_CUT group): the path drawn on a face — ended by the
// 2nd click of the segment tool, or Enter / double click / back on its first
// point for the polyline tool — cuts that face in two
// (cutFaceAlongPathService). The tool stays armed for the next cut. Its
// rectangle tool anchors on a face and cuts the loop at the 2nd click (or
// Enter with X / Y typed dimensions — the 2D rectangle's bottom bar); its
// axis tools (« Découpe horizontale / verticale ») cut, on a click or Enter,
// the line FaceCutAxisOverlayThreed previews on the hovered face (digits
// type the cut distance, S flips the side of the vertical one).
//
// Template-less and face-cut clicks and keys run one at a time, in order (a
// commit awaits the db): each step reads the live drawing state from the
// store.
export default function useDrawingPointerHandlers() {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const noPlanEncodingS =
    "Trait non enregistré : un tronçon vertical ne peut pas être porté par le plan.";
  const noFaceCutByReasonS = {
    NO_ANNOTATION: "Aucune face coupée : le tracé n'est sur aucune annotation.",
    NOT_EDITABLE:
      "Aucune face coupée : cette annotation ne peut pas être découpée (ouvertures, soustractions, forme générée…).",
    NOT_ON_ONE_FACE:
      "Aucune face coupée : le tracé doit rester sur une seule face.",
    NOT_EDGE_TO_EDGE:
      "Aucune face coupée : le tracé doit aller d'un bord à l'autre de la face (ou y faire une boucle).",
  };
  const faceCutFailedS = "La coupe de la face n'a pas pu être enregistrée.";

  const active = useSelector((s) => s.threedEditor.drawingMode.active);
  const inProgressPolyline = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline
  );
  const trait3DSegments = useSelector(
    (s) => s.threedEditor.drawingMode.trait3DSegments
  );
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const baseMaps = useBaseMaps()?.value;
  const mainBaseMapId = useMainBaseMap()?.id;

  // Template-driven mode (see useTemplateFaceDrawBridge): the committed face
  // carries the armed template + layer instead of isPendingTemplate.
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

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
  // Last axis cut (« Découpe horizontale / verticale »): the 2nd click of a
  // double click on it must not cut the new face again.
  const lastAxisCutTimeRef = useRef(0);

  // A "Coupe face" tool left or switched (toolbar, Tab, letters — the 2D
  // switch helpers clear nothing in 3D): the path in progress, the rectangle
  // anchor and the typed dimensions / distance belong to the previous tool.
  const prevModeRef = useRef(enabledDrawingMode);
  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = enabledDrawingMode;
    if (prev === enabledDrawingMode) return;
    if (
      !isFaceCutDrawingMode(prev) &&
      !isFaceCutDrawingMode(enabledDrawingMode)
    )
      return;
    dispatch(cancelInProgressPolyline());
    dispatch(clearRectDims());
    dispatch(setRectHasFirstPoint(false));
    dispatch(clearConstraintBuffer());
  }, [enabledDrawingMode, dispatch]);
  const prevActiveRef = useRef(active);
  useEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = active;
    if (prev && !active) {
      dispatch(clearRectDims());
      dispatch(setRectHasFirstPoint(false));
      dispatch(clearConstraintBuffer());
    }
  }, [active, dispatch]);
  // Serialized template-less / face-cut steps (clicks and keys).
  const queueRef = useRef(Promise.resolve());
  // Last click that ended the path in progress (commit or cut): the second
  // click of a double click on it must not start a new path.
  const lastPathEndRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    // « Pinceau »: it rides the drawing bridge for its guards only — no
    // vertex drawing, no keys (useMeshBrushPointerHandlers owns its clicks
    // and Escape).
    if (isMeshBrushDrawingMode(enabledDrawingMode)) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    if (!dom) return;

    const behavior = getDrawingToolByKey(enabledDrawingMode)?.behavior;
    // "H" | "V" for the face cut axis tools, null otherwise.
    const faceCutAxis = getFaceCutAxis(enabledDrawingMode);

    function hasTemplate() {
      const na = newAnnotationRef.current;
      return Boolean(
        na?.annotationTemplateId &&
        (na?.type === "POLYGON" || na?.type === "POLYLINE")
      );
    }

    async function commitFace(cornersInOrder) {
      return await commitDrawnFaceService({
        cornersInOrder,
        baseMaps: baseMaps || [],
        projectId,
        listingId,
        templateProps: newAnnotationRef.current,
        layerId: activeLayerIdRef.current ?? null,
        createAnnotationFn: createAnnotation,
      });
    }

    async function commitPolyline(verticesInOrder, { closeLine = false } = {}) {
      return await commitDrawnPolylineService({
        verticesInOrder,
        baseMaps: baseMaps || [],
        projectId,
        listingId,
        templateProps: newAnnotationRef.current,
        layerId: activeLayerIdRef.current ?? null,
        createAnnotationFn: createAnnotation,
        closeLine,
      });
    }

    function isTemplatelessDraw() {
      return isTemplatelessDraft(newAnnotationRef.current);
    }

    function isFaceCutDraw() {
      return isFaceCutDrawingMode(enabledDrawingMode);
    }

    // One step at a time, in order: a click landing while the previous
    // commit is still resolving runs after it, on the state it left.
    function enqueue(task) {
      queueRef.current = queueRef.current
        .then(() => {
          if (!store.getState().threedEditor.drawingMode.active) return;
          return task();
        })
        .catch((err) =>
          console.error("[threedDrawing] drawing step failed", err)
        );
      return queueRef.current;
    }

    function getLiveDrawing() {
      const s = store.getState();
      return {
        inProgress: s.threedEditor.drawingMode.inProgressPolyline,
        draft: s.annotations.newAnnotation,
      };
    }

    const isSamePoint = (p, q) =>
      Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < SAME_POINT_EPS_M;

    // A click step, queued. A click that ended the path in progress is
    // remembered: the second click of a double click on it is dropped
    // instead of starting a new path there.
    function enqueueClick(handler, snap, clickTime) {
      return enqueue(async () => {
        const before = getLiveDrawing().inProgress.length;
        const lastEnd = lastPathEndRef.current;
        if (
          before === 0 &&
          lastEnd &&
          clickTime - lastEnd.time < DOUBLE_CLICK_MS &&
          isSamePoint(lastEnd.position, snap.position)
        ) {
          lastPathEndRef.current = null;
          return;
        }
        await handler(snap);
        if (before > 0 && getLiveDrawing().inProgress.length === 0) {
          const { x, y, z } = snap.position;
          lastPathEndRef.current = { position: { x, y, z }, time: clickTime };
        }
      });
    }

    // "Dessin" tool, line type, with a point picked on a scan base map: the
    // path becomes a templateless POLYLINE annotation lying on the scan
    // (straight segments between the picked points).
    function isScanPath(vertices) {
      return (
        getLiveDrawing().draft?.type === "POLYLINE" &&
        vertices.some((v) => v.snapKind === "SCAN")
      );
    }

    async function commitScanPath(vertices) {
      if (vertices.length < 2) return false;
      try {
        const { annotation: created, reason } = await commitDrawnPolyline({
          verticesInOrder: vertices,
          baseMaps: baseMaps || [],
          projectId,
          scopeId,
          templateProps: getLiveDrawing().draft,
          layerId: activeLayerIdRef.current ?? null,
          createAnnotationFn: createAnnotation,
        });
        if (!created) {
          if (reason === POLYLINE_COMMIT_NO_2D_ENCODING) {
            dispatch(
              setToaster({ message: noPlanEncodingS, severity: "warning" })
            );
          }
          return false;
        }
        console.log(
          `[threedDrawing] scan polyline created: ${created.id} on baseMap ${created.baseMapId}`
        );
        warnIfOffMainBaseMap(created);
        finishCommit();
        return true;
      } catch (err) {
        console.error("[threedDrawing] scan polyline commit failed", err);
        return false;
      }
    }

    // The drawn shape as a template-less annotation (2D Dessin parity), by
    // the draft type: a POLYGON (3+ points) encoded on its plan — a flat mesh
    // sheet only when it has none —, else a POLYLINE (2+ points, closed with
    // `closed`). True when committed.
    async function commitTemplateless(points, { closed = false } = {}) {
      const draft = getLiveDrawing().draft;
      const common = {
        baseMaps: baseMaps || [],
        projectId,
        scopeId,
        templateProps: draft,
        layerId: activeLayerIdRef.current ?? null,
        createAnnotationFn: createAnnotation,
      };
      let created = null;
      try {
        if (draft?.type === "POLYGON") {
          if (points.length < 3) return false;
          const { annotation, reason } = await commitDrawnFace({
            ...common,
            cornersInOrder: points,
          });
          created = annotation;
          if (!created && reason === FACE_COMMIT_NO_2D_ENCODING) {
            created = await createFlatMesh3dAnnotationService({
              editor,
              vertices: points,
              baseMaps: common.baseMaps,
              projectId,
              scopeId,
              draftProps: draft,
              layerId: common.layerId,
              createAnnotationFn: createAnnotation,
            });
          }
        } else {
          if (points.length < 2) return false;
          const { annotation, reason } = await commitDrawnPolyline({
            ...common,
            verticesInOrder: points,
            closeLine: closed,
          });
          created = annotation;
          if (!created && reason === POLYLINE_COMMIT_NO_2D_ENCODING) {
            dispatch(
              setToaster({ message: noPlanEncodingS, severity: "warning" })
            );
          }
        }
      } catch (err) {
        console.error("[threedDrawing] template-less commit failed", err);
        return false;
      }
      if (!created) return false;
      console.log(
        `[threedDrawing] template-less ${created.type} created: ${created.id} on baseMap ${created.baseMapId}${created.isMesh3d ? " (mesh sheet)" : ""}`
      );
      warnIfOffMainBaseMap(created);
      finishCommit();
      return true;
    }

    // End of a click-drawn template-less path (Enter, double click, Escape,
    // back on its first point). A POLYGON closes by nature, a POLYLINE only
    // back on its first point. True when committed.
    async function endPath(points, { closed = false } = {}) {
      if (isScanPath(points)) return await commitScanPath(points);
      const closes = closed || getLiveDrawing().draft?.type === "POLYGON";
      if (closes && points.length < 3) return false;
      return await commitTemplateless(points, { closed: closes });
    }

    function toDrawingVertex(snap, extra = {}) {
      const n = snap.faceNormal;
      return {
        x: snap.position.x,
        y: snap.position.y,
        z: snap.position.z,
        meshKey: snap.meshKey,
        snapKind: snap.kind,
        ...(snap.baseMapId ? { baseMapId: snap.baseMapId } : {}),
        ...(snap.nodeId ? { nodeId: snap.nodeId } : {}),
        ...(n ? { faceNormal: { x: n.x, y: n.y, z: n.z } } : {}),
        ...extra,
      };
    }

    async function onTemplatelessClick(snap) {
      const { inProgress } = getLiveDrawing();

      if (behavior === "RECTANGLE") {
        if (inProgress.length === 0) {
          // The anchor needs a plane: the face under the cursor, else the
          // base map plane it sits on.
          let baseMapId = snap.baseMapId ?? null;
          if (!snap.faceNormal && !baseMapId) {
            baseMapId =
              resolveBaseMapForPoint(snap.position, baseMaps || [])?.baseMap
                ?.id ?? null;
          }
          if (!snap.faceNormal && !baseMapId) {
            console.warn(
              "[threedDrawing] rectangle anchor ignored: on no face nor plan"
            );
            return;
          }
          dispatch(
            pushDrawingVertex(
              toDrawingVertex(snap, baseMapId ? { baseMapId } : {})
            )
          );
          return;
        }
        const anchor = inProgress[0];
        const host = (baseMaps || []).find((b) => b.id === anchor.baseMapId);
        const corners = anchor.faceNormal
          ? computeRectangleCornersOnPlane(
              anchor,
              snap.position,
              anchor.faceNormal
            )
          : host
            ? computeRectangleCorners(anchor, snap.position, host)
            : null;
        if (!corners) return; // degenerate: stay armed
        const vertices = corners.map((c) => ({
          x: c.x,
          y: c.y,
          z: c.z,
          snapKind: anchor.snapKind,
          ...(anchor.nodeId ? { nodeId: anchor.nodeId } : {}),
          ...(anchor.baseMapId ? { baseMapId: anchor.baseMapId } : {}),
        }));
        if (!(await commitTemplateless(vertices, { closed: true }))) {
          console.warn(
            "[threedDrawing] rectangle committed nothing: cancelled"
          );
          dispatch(cancelInProgressPolyline());
        }
        return;
      }

      const newVertex = toDrawingVertex(snap);
      const last = inProgress[inProgress.length - 1];
      if (last && isSamePoint(last, newVertex)) {
        // Double click: ends a click-drawn path.
        if (behavior !== "SEGMENT" && inProgress.length >= 2) {
          await endPath(inProgress);
        }
        return;
      }

      if (inProgress.length === 0) {
        dispatch(pushDrawingVertex(newVertex));
        return;
      }

      const drawn = [...inProgress, newVertex];
      // Line on a scan base map: "Segment (2 clics)" commits on the second
      // click, "Polyligne clic" keeps adding points until Enter.
      if (isScanPath(drawn)) {
        if (behavior === "SEGMENT") {
          await commitScanPath(drawn);
        } else {
          dispatch(pushDrawingVertex(newVertex));
        }
        return;
      }

      // Back on the first point: the contour is closed. One that commits
      // nothing stays as drawn (Escape discards it).
      if (inProgress.length >= 3 && isSamePoint(inProgress[0], newVertex)) {
        await endPath(inProgress, { closed: true });
        return;
      }

      // "Segment (2 clics)": the segment ends here.
      if (behavior === "SEGMENT") {
        if (!(await commitTemplateless(drawn))) {
          dispatch(cancelInProgressPolyline());
        }
        return;
      }
      dispatch(pushDrawingVertex(newVertex));
    }

    // "Coupe face": cut of the face the path lies on, whatever the outcome
    // the path is consumed and the tool stays armed.
    async function cutFace(points, { closed = false } = {}) {
      try {
        const result = await cutFaceAlongPathService({
          editor,
          vertices: points,
          closed,
          projectId,
          dispatch,
          createAnnotationFn: createAnnotation,
          updateAnnotationFn: updateAnnotation,
        });
        console.log(
          `[threedDrawing] face cut: ${result.kind}${result.annotationId ? ` ${result.annotationId}` : ""}`
        );
        if (result.kind === "NONE") {
          const message =
            noFaceCutByReasonS[result.reason] ??
            noFaceCutByReasonS.NOT_EDGE_TO_EDGE;
          dispatch(setToaster({ message, severity: "warning" }));
        } else if (result.kind === "FAILED") {
          dispatch(setToaster({ message: faceCutFailedS, severity: "error" }));
        }
      } catch (err) {
        console.error("[threedDrawing] face cut failed", err);
        dispatch(
          setToaster({
            message: err?.message || faceCutFailedS,
            severity: "error",
          })
        );
      }
      finishCommit();
    }

    // "Coupe face" rectangle: the loop anchored on a face, its sides along
    // the face's frame (getFaceCutBasisWorld), the typed X / Y dimensions
    // replacing the cursor's. True when a cut was attempted (the anchor is
    // consumed either way); false when the corners are degenerate.
    async function cutRectangle(anchor, cursorPosition) {
      const { rectXBuffer, rectYBuffer } = store.getState().mapEditor;
      const baseMapGroup =
        editor.sceneManager?.imagesManager?.getGroup?.(anchor.baseMapId) ??
        null;
      const basis = getFaceCutBasisWorld(
        anchor.faceNormal,
        anchor,
        baseMapGroup
      );
      const corners = computeRectangleCornersOnPlane(
        anchor,
        cursorPosition,
        anchor.faceNormal,
        {
          forcedDu: parseRectBuffer(rectXBuffer),
          forcedDv: parseRectBuffer(rectYBuffer),
          basis,
        }
      );
      if (!corners) return false;
      const vertices = corners.map((c) => ({
        x: c.x,
        y: c.y,
        z: c.z,
        snapKind: anchor.snapKind,
        ...(anchor.nodeId ? { nodeId: anchor.nodeId } : {}),
        ...(anchor.baseMapId ? { baseMapId: anchor.baseMapId } : {}),
        faceNormal: anchor.faceNormal,
      }));
      await cutFace(vertices, { closed: true });
      dispatch(clearRectDims());
      dispatch(setRectHasFirstPoint(false));
      return true;
    }

    // « Découpe horizontale / verticale »: the line previewed on the hovered
    // face (FaceCutAxisOverlayThreed) cuts it.
    async function cutFaceAlongAxis() {
      const hover = getFaceCutAxisHover();
      if (!hover?.chordWorld) return;
      if (hover.endsOnHole) {
        dispatch(
          setToaster({
            message: noFaceCutByReasonS.NOT_EDGE_TO_EDGE,
            severity: "warning",
          })
        );
        return;
      }
      lastAxisCutTimeRef.current = performance.now();
      await cutFace(hover.chordWorld);
      clearFaceCutHoverCache();
    }

    async function onFaceCutClick(snap) {
      const { inProgress } = getLiveDrawing();

      if (behavior === "RECTANGLE") {
        if (inProgress.length === 0) {
          // The anchor needs a face: the rectangle lives on its plane.
          if (!snap.faceNormal) {
            console.warn(
              "[threedDrawing] face cut rectangle anchor ignored: on no face"
            );
            return;
          }
          dispatch(pushDrawingVertex(toDrawingVertex(snap)));
          dispatch(setRectHasFirstPoint(true));
          return;
        }
        if (!(await cutRectangle(inProgress[0], snap.position))) {
          console.warn(
            "[threedDrawing] face cut rectangle 2nd click ignored: degenerate corners"
          );
        }
        return;
      }

      const newVertex = toDrawingVertex(snap);
      const last = inProgress[inProgress.length - 1];
      if (last && isSamePoint(last, newVertex)) {
        // Double click: ends the polyline there.
        if (behavior !== "SEGMENT" && inProgress.length >= 2) {
          await cutFace(inProgress);
        }
        return;
      }
      if (inProgress.length === 0) {
        dispatch(pushDrawingVertex(newVertex));
        return;
      }
      if (behavior === "SEGMENT") {
        await cutFace([...inProgress, newVertex]);
        return;
      }
      // Back on the first point: a loop, cut out of the face.
      if (inProgress.length >= 3 && isSamePoint(inProgress[0], newVertex)) {
        await cutFace(inProgress, { closed: true });
        return;
      }
      dispatch(pushDrawingVertex(newVertex));
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

    // Keys of « Découpe horizontale / verticale »: digits type the cut
    // distance (mapEditor.constraintBuffer, shown in FaceCutAxisBottomBar),
    // S flips the side of the vertical cut, Enter cuts like a click. True
    // when consumed.
    function onFaceCutAxisKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (/^[0-9.,]$/.test(e.key)) {
        e.preventDefault();
        dispatch(appendToConstraintBuffer(e.key === "," ? "." : e.key));
        return true;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        dispatch(deleteLastConstraintBuffer());
        return true;
      }
      if ((e.key === "s" || e.key === "S") && faceCutAxis === "V") {
        if (!e.repeat) dispatch(toggleFaceCutSide());
        e.preventDefault();
        return true;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        enqueue(cutFaceAlongAxis);
        return true;
      }
      return false;
    }

    // Keys of the "Coupe face" rectangle once its anchor is placed (2D
    // rectangle parity, InteractionLayer): X / Y target a dimension, digits
    // type it, "-" flips its sign, Backspace erases, Enter cuts with the
    // typed dimensions (a missing one follows the cursor). True when
    // consumed.
    async function onFaceCutRectangleKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        dispatch(setRectCurrentAxis("x"));
        dispatch(setRectXBuffer(""));
        return true;
      }
      if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        dispatch(setRectCurrentAxis("y"));
        dispatch(setRectYBuffer(""));
        return true;
      }
      const axis = store.getState().mapEditor.rectCurrentAxis;
      if (axis) {
        const isX = axis === "x";
        if (e.key === "-") {
          e.preventDefault();
          dispatch(isX ? toggleRectXBufferSign() : toggleRectYBufferSign());
          return true;
        }
        if (/^[0-9.,]$/.test(e.key)) {
          e.preventDefault();
          const char = e.key === "," ? "." : e.key;
          dispatch(isX ? appendToRectXBuffer(char) : appendToRectYBuffer(char));
          return true;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          dispatch(isX ? deleteLastRectXBuffer() : deleteLastRectYBuffer());
          return true;
        }
        if (e.key === " ") {
          e.preventDefault();
          return true;
        }
      }
      if (e.key === "Enter") {
        const { rectXBuffer, rectYBuffer } = store.getState().mapEditor;
        if (
          parseRectBuffer(rectXBuffer) == null &&
          parseRectBuffer(rectYBuffer) == null
        ) {
          return true; // nothing typed: the 2nd click commits
        }
        e.preventDefault();
        await enqueue(async () => {
          const { inProgress } = getLiveDrawing();
          const anchor = inProgress[0];
          // The free dimension follows the cursor (its last snap).
          const cursor = getLastSnap()?.position ?? anchor;
          if (!anchor) return;
          if (!(await cutRectangle(anchor, cursor))) {
            console.warn(
              "[threedDrawing] face cut rectangle Enter ignored: degenerate corners"
            );
          }
        });
        return true;
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

      const clickTime = performance.now();
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
      // Axis cut: no drawn vertex, the hovered line is the cut.
      if (faceCutAxis) {
        if (clickTime - lastAxisCutTimeRef.current < DOUBLE_CLICK_MS) return;
        await enqueue(cutFaceAlongAxis);
        return;
      }
      if (!snap?.position) {
        console.warn("[threedDrawing] click ignored: no snap under cursor");
        return;
      }

      if (isFaceCutDraw()) {
        await enqueueClick(onFaceCutClick, snap, clickTime);
        return;
      }
      if (isTemplatelessDraw()) {
        await enqueueClick(onTemplatelessClick, snap, clickTime);
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
      if (isFaceCutDraw()) {
        if (faceCutAxis) {
          if (onFaceCutAxisKey(e)) return;
        } else if (
          behavior === "RECTANGLE" &&
          inProgressPolyline.length === 1
        ) {
          if (await onFaceCutRectangleKey(e)) return;
        }
        if (e.key === "Enter") {
          if (behavior === "SEGMENT" || behavior === "RECTANGLE") return;
          await enqueue(async () => {
            const { inProgress } = getLiveDrawing();
            if (inProgress.length >= 2) await cutFace(inProgress);
          });
        } else if (e.key === "Escape") {
          // A cut is never made on Escape: the path is dropped (with the
          // typed dimensions / distance), then the tool is left.
          const { constraintBuffer } = store.getState().mapEditor;
          if (inProgressPolyline.length > 0) {
            dispatch(cancelInProgressPolyline());
            dispatch(clearRectDims());
            dispatch(setRectHasFirstPoint(false));
          } else if (faceCutAxis && constraintBuffer) {
            dispatch(clearConstraintBuffer());
          } else {
            dispatch(setEnabledDrawingMode(null));
            dispatch(setNewAnnotation({}));
          }
        }
        return;
      }
      if (isTemplatelessDraw()) {
        if (e.key === "Enter") {
          if (behavior === "RECTANGLE") return;
          await enqueue(async () => {
            const { inProgress } = getLiveDrawing();
            if (inProgress.length >= 2) await endPath(inProgress);
          });
        } else if (e.key === "Escape") {
          if (inProgressPolyline.length === 0) {
            dispatch(setEnabledDrawingMode(null));
            dispatch(setNewAnnotation({}));
            return;
          }
          // 2D parity: Escape mid-drawing ends a click-drawn path like Enter;
          // a segment / rectangle in progress, or a path that commits
          // nothing, is discarded.
          await enqueue(async () => {
            const { inProgress } = getLiveDrawing();
            if (!inProgress.length) return;
            const committed =
              behavior !== "SEGMENT" &&
              behavior !== "RECTANGLE" &&
              inProgress.length >= 2 &&
              (await endPath(inProgress));
            if (!committed) dispatch(cancelInProgressPolyline());
          });
        }
        return;
      }
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
    scopeId,
    listingId,
    enabledDrawingMode,
    dispatch,
  ]);
}
