import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";
import { Vector3 } from "three";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setToaster } from "Features/layout/layoutSlice";
import commitDrawnRevolutionAxisService from "Features/revolutionAxes/services/commitDrawnRevolutionAxisService";
import {
  appendToConstraintBuffer,
  appendToPatternRepeatBuffer,
  appendToRectXBuffer,
  appendToRectYBuffer,
  clearConstraintBuffer,
  clearPatternRepeatBuffer,
  clearRectDims,
  deleteLastConstraintBuffer,
  deleteLastPatternRepeatBuffer,
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
  appendDrawingVertices,
  bumpSnapIndexEpoch,
  cancelInProgressPolyline,
  flushInProgressAsTrait3D,
  pushDrawingVertex,
  toggleFaceCutSide,
  toggleLastDrawingVertexType,
} from "Features/threedEditor/threedEditorSlice";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools";
import parseRectBuffer from "Features/mapEditor/utils/parseRectBuffer";
import {
  getPatternSegmentCount,
  parsePatternRepeatCount,
  repeatDrawingPattern,
} from "Features/mapEditor/utils/patternRepeat";
import PATTERN_REPEAT_DRAWING_MODES from "Features/mapEditor/constants/patternRepeatDrawingModes";

import createFlatMesh3dAnnotationService from "Features/annotationMesh3d/services/createFlatMesh3dAnnotationService";
import cutFaceAlongPathService from "Features/threedFaceCut/services/cutFaceAlongPathService";
import cutSurfaceAlongPlaneService from "Features/threedFaceCut/services/cutSurfaceAlongPlaneService";
import {
  clearFaceCutHoverCache,
  getFaceCutAxisHover,
} from "Features/threedFaceCut/services/faceCutAxisStore";
import {
  getFaceCutAxis,
  isFaceCutDrawingMode,
} from "Features/threedFaceCut/utils/faceCutTools";
import getFaceCutBasisWorld from "Features/threedFaceCut/utils/getFaceCutBasisWorld";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import resolveFaceCutLockedFace from "Features/threedFaceCut/utils/resolveFaceCutLockedFace";
import { isMeshBrushDrawingMode } from "Features/meshPaint/utils/meshBrushTools";

import {
  FACE_COMMIT_NO_2D_ENCODING,
  commitDrawnFace,
} from "../services/commitDrawnFaceService";
import commitDrawnPolylineService, {
  commitDrawnPolyline,
} from "../services/commitDrawnPolylineService";
import commitDrawnCoteService from "../services/commitDrawnCoteService";
import commitDrawnDiscService, {
  DISC_COMMIT_NOT_PARALLEL,
  DISC_COMMIT_NO_SCALE,
} from "../services/commitDrawnDiscService";
import { getLastSnap } from "../services/lastSnapStore";
import {
  DEFAULT_RECT_SIDE_AXES,
  getRectangleFrame,
} from "../services/rectangleFrameStore";
import computeRectangleCornersOnPlane from "../utils/computeRectangleCornersOnPlane";
import resolveBaseMapForPoint from "../utils/resolveBaseMapForPoint";
import {
  isRevolutionAxisDraftFor3d,
  isTemplatelessDraft,
  isPolylineClickDraftFor3d,
} from "../utils/templateFaceDrawSelectors";

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
// since pointerdown — drags belong to OrbitControls. The shape never closes
// on its own (existing mesh vertices / edges are snap targets only): it is
// committed by a click back on its first point, Enter or Escape.
//
// Keys mirror the 2D editor: Enter — and Escape with points in progress —
// commit the drawing as an annotation when a template is armed (open
// POLYLINE, or POLYGON with 3+ points); Escape with nothing exits the tool.
// Without a template, Enter keeps its historical behavior of flushing the
// polyline as a persistent wireframe trait.
//
// RECTANGLE-behavior tools get their own two-click flow: first click anchors
// anywhere a first point lands (a plan, a face), second click commits the
// rectangle DrawingOverlayThreed previews on the natural plane of the anchor
// (rectangleFrameStore: its base map image frame, or a plane whose sides
// follow the user axes of the gizmo frame).
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
// type the cut distance, S flips the side of the vertical one). Launched
// while a face is selected, every tool is bound to that face
// (resolveFaceCutLockedFace): the path is drawn on it and only it is cut.
//
// Revolution axis drawn from 3D (REVOLUTION_AXIS draft, REVOLUTION_AXIS_PLAN
// tool — isRevolutionAxisDraftFor3d): the DISC two-click flow without a
// template — 1st click = the centre, on a HORIZONTAL base map plane only;
// 2nd click = a rim point on that plane (radius + diameter direction) →
// commitDrawnRevolutionAxisService, then the tool disarms (one-shot, like
// the 2D tool). Enter is ignored, Escape drops the centre / exits the tool.
//
// Cote (COTE draft, COTE_TWO_CLICK tool — a template row or the "Dessin"
// tool on its cote type): two clicks anywhere the drawing's snap cascade
// lands (a plan, a face, a vertex, an edge, an axis lock, the natural plane,
// free), the 2nd one committing the COTE annotation
// (commitDrawnCoteService) — the typed length constrains it like a segment.
// The tool stays armed for the next cote; Enter is ignored, Escape drops the
// 1st point / exits the tool.
//
// Template-less, face-cut and cote clicks and keys run one at a time, in
// order (a commit awaits the db): each step reads the live drawing state
// from the store.
export default function useDrawingPointerHandlers() {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const noFaceCutByReasonS = {
    NO_ANNOTATION: "Aucune face coupée : le tracé n'est sur aucune annotation.",
    NOT_EDITABLE:
      "Aucune face coupée : cette annotation ne peut pas être découpée (ouvertures, soustractions, forme générée…).",
    NOT_ON_ONE_FACE:
      "Aucune face coupée : le tracé doit rester sur une seule face.",
    NOT_EDGE_TO_EDGE:
      "Aucune face coupée : le tracé doit aller d'un bord à l'autre de la face (ou y faire une boucle).",
    NOT_ON_SELECTED_FACE:
      "Aucune face coupée : le tracé doit rester sur la face sélectionnée.",
    NO_BASE_MAP:
      "Aucune face coupée : le fond de plan de l'annotation n'est pas affiché.",
  };
  const faceCutFailedS = "La coupe de la face n'a pas pu être enregistrée.";
  const axisNoScopeS = "Sélectionnez un scope avant de dessiner un axe";
  const axisNotOnPlanS = "Placez le centre de l'axe sur un plan horizontal";

  const active = useSelector((s) => s.threedEditor.drawingMode.active);
  const inProgressPolyline = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline
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
  // Same for the axis tool (A) armed over a path in progress, or left for a
  // template: its centre is not a polygon vertex, nor the reverse.
  const prevModeRef = useRef(enabledDrawingMode);
  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = enabledDrawingMode;
    if (prev === enabledDrawingMode) return;
    const isAxisMode = (mode) => mode === "REVOLUTION_AXIS_PLAN";
    if (
      !isFaceCutDrawingMode(prev) &&
      !isFaceCutDrawingMode(enabledDrawingMode) &&
      !isAxisMode(prev) &&
      !isAxisMode(enabledDrawingMode)
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
      dispatch(clearPatternRepeatBuffer());
    }
  }, [active, dispatch]);
  // A `*N` typed for the path just ended / dropped (commit, Escape, cut).
  useEffect(() => {
    if (!active || inProgressPolyline.length > 0) return;
    if (store.getState().mapEditor.patternRepeatBuffer) {
      dispatch(clearPatternRepeatBuffer());
    }
  }, [active, inProgressPolyline.length, store, dispatch]);
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
        (na?.type === "POLYGON" ||
          na?.type === "POLYLINE" ||
          na?.type === "DISC")
      );
    }

    // DISC draft with the centre / radius tool: its own 2-click flow.
    function isDiscDraw() {
      return (
        behavior === "CIRCLE_RADIUS" &&
        newAnnotationRef.current?.type === "DISC" &&
        hasTemplate()
      );
    }

    // COTE draft (template or "Dessin" on its cote type): its own 2-click
    // flow on the generic snap cascade. Checked before the template-less
    // branch — a template-less cote must not commit as a polyline.
    function isCoteDraw() {
      return (
        enabledDrawingMode === "COTE_TWO_CLICK" &&
        newAnnotationRef.current?.type === "COTE"
      );
    }

    // REVOLUTION_AXIS draft (A): the disc's 2-click flow, no template.
    function isAxisDraw() {
      return (
        behavior === "CIRCLE_RADIUS" &&
        isRevolutionAxisDraftFor3d(newAnnotationRef.current, enabledDrawingMode)
      );
    }

    // Line drawn click by click (template or "Dessin"): T toggles its last
    // point to an arc point (onArcToggleKey).
    function isPolylineClickDraw() {
      return isPolylineClickDraftFor3d(
        newAnnotationRef.current,
        enabledDrawingMode
      );
    }

    // Plan REVOLUTION_AXIS row from the centre's base map (its image frame
    // and scale) — colour / ht. / Offset from the armed draft.
    async function commitAxis(center, rim) {
      const host = (baseMaps || []).find((bm) => bm.id === center.baseMapId);
      return await commitDrawnRevolutionAxisService({
        center,
        edge: rim,
        host,
        projectId,
        scopeId,
        draft: newAnnotationRef.current,
        layerId: activeLayerIdRef.current ?? null,
        createAnnotationFn: createAnnotation,
      });
    }

    // COTE from its two endpoints (world): in-plane cotes share the 2D
    // encoding, lifted / vertical ones carry offsets (commitDrawnCoteService).
    async function commitCote(a, b) {
      return await commitDrawnCoteService({
        a,
        b,
        baseMaps: baseMaps || [],
        projectId,
        listingId,
        scopeId,
        templateProps: newAnnotationRef.current,
        layerId: activeLayerIdRef.current ?? null,
        createAnnotationFn: createAnnotation,
        // Endpoints snapped on annotations / axis locks carry no base map:
        // the cote then belongs to the plan selected in 2D.
        preferredBaseMapId: mainBaseMapId ?? null,
      });
    }

    async function commitDisc(center, rim) {
      const { annotation, reason } = await commitDrawnDiscService({
        center,
        rim,
        baseMaps: baseMaps || [],
        projectId,
        listingId,
        templateProps: newAnnotationRef.current,
        layerId: activeLayerIdRef.current ?? null,
        createAnnotationFn: createAnnotation,
        preferredBaseMapId: mainBaseMapId ?? null,
      });
      if (!annotation) {
        const message =
          reason === DISC_COMMIT_NOT_PARALLEL
            ? "Un disque se dessine parallèlement à son fond de plan : placez le centre sur un plan."
            : reason === DISC_COMMIT_NO_SCALE
              ? "Le fond de plan n'a pas d'échelle : impossible de créer un disque."
              : null;
        if (message) dispatch(setToaster({ message, severity: "warning" }));
      }
      return annotation;
    }

    // Templated face: encoded on its plan when it can be — else (a vertical
    // face the band cannot reproduce) a flat mesh sheet keeping the template
    // and its listing, whose plan projection is a segment.
    async function commitFace(cornersInOrder) {
      const common = {
        baseMaps: baseMaps || [],
        projectId,
        listingId,
        layerId: activeLayerIdRef.current ?? null,
        createAnnotationFn: createAnnotation,
        // Vertices snapped on existing annotations / axis locks carry no
        // base map: the shape then belongs to the plan selected in 2D.
        preferredBaseMapId: mainBaseMapId ?? null,
      };
      const { annotation, reason } = await commitDrawnFace({
        ...common,
        cornersInOrder,
        templateProps: newAnnotationRef.current,
      });
      if (annotation || reason !== FACE_COMMIT_NO_2D_ENCODING) {
        return annotation;
      }
      return await createFlatMesh3dAnnotationService({
        ...common,
        editor,
        vertices: cornersInOrder,
        scopeId,
        draftProps: newAnnotationRef.current,
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
        preferredBaseMapId: mainBaseMapId ?? null,
      });
    }

    function isTemplatelessDraw() {
      return isTemplatelessDraft(newAnnotationRef.current);
    }

    function isFaceCutDraw() {
      return isFaceCutDrawingMode(enabledDrawingMode);
    }

    // « Répétition du motif » (`*N`, utils/patternRepeat — 2D parity):
    // click-drawn POLYLINE / POLYGON paths, template or template-less.
    function isPatternRepeatDraw() {
      return (
        PATTERN_REPEAT_DRAWING_MODES.includes(enabledDrawingMode) &&
        behavior !== "RECTANGLE" &&
        !isFaceCutDraw() &&
        !isDiscDraw() &&
        !isAxisDraw() &&
        !isCoteDraw()
      );
    }

    // Click / Enter with a `*N` typed: the repeated vertices are appended,
    // nothing at the cursor. Returns the path after it (unchanged when
    // nothing repeats: "*0", closed pattern), or null when no repetition
    // was pending.
    function applyPendingPatternRepeat() {
      const buffer = store.getState().mapEditor.patternRepeatBuffer;
      if (!buffer) return null;
      dispatch(clearPatternRepeatBuffer());
      const { inProgress } = getLiveDrawing();
      if (!isPatternRepeatDraw()) return inProgress;
      const count = parsePatternRepeatCount(buffer);
      const repeated = count ? repeatDrawingPattern(inProgress, count) : [];
      if (repeated.length === 0) return inProgress;
      dispatch(appendDrawingVertices(repeated));
      return [...inProgress, ...repeated];
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
        const { annotation: created } = await commitDrawnPolyline({
          verticesInOrder: vertices,
          baseMaps: baseMaps || [],
          projectId,
          scopeId,
          templateProps: getLiveDrawing().draft,
          layerId: activeLayerIdRef.current ?? null,
          createAnnotationFn: createAnnotation,
          preferredBaseMapId: mainBaseMapId ?? null,
        });
        if (!created) return false;
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
        preferredBaseMapId: mainBaseMapId ?? null,
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
              preferredBaseMapId: common.preferredBaseMapId,
            });
          }
        } else {
          if (points.length < 2) return false;
          const { annotation } = await commitDrawnPolyline({
            ...common,
            verticesInOrder: points,
            closeLine: closed,
          });
          created = annotation;
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

    // Rectangle anchor: the first point, with the base map plane it sits on
    // when the snap carries none (a vertex of an existing annotation) — the
    // natural plane of the rectangle then prefers that plan.
    function toRectangleAnchor(snap) {
      let baseMapId = snap.baseMapId ?? null;
      if (!snap.faceNormal && !baseMapId) {
        baseMapId =
          resolveBaseMapForPoint(snap.position, baseMaps || [])?.baseMap?.id ??
          null;
      }
      return toDrawingVertex(snap, baseMapId ? { baseMapId } : {});
    }

    // Cote: 1st click = the first endpoint (as snapped — a plane snap
    // carries its base map, a vertex / axis one none), 2nd click = the
    // other endpoint → commit, the tool staying armed for the next cote.
    async function onCoteClick(snap) {
      const { inProgress } = getLiveDrawing();
      if (inProgress.length === 0) {
        dispatch(pushDrawingVertex(toDrawingVertex(snap)));
        return;
      }
      const a = inProgress[0];
      const b = {
        x: snap.position.x,
        y: snap.position.y,
        z: snap.position.z,
        ...(snap.baseMapId ? { baseMapId: snap.baseMapId } : {}),
      };
      if (isSamePoint(a, b)) return; // stay armed
      // The typed length was applied to this point (preview snap): consumed.
      releaseLengthConstraint();
      try {
        const created = await commitCote(a, b);
        if (created) {
          console.log(
            `[threedDrawing] cote annotation created: ${created.id} on baseMap ${created.baseMapId} (listing ${created.listingId})`
          );
          warnIfOffMainBaseMap(created);
          finishCommit();
        } else {
          console.warn(
            "[threedDrawing] cote commit returned null (see abort reason above)"
          );
        }
      } catch (err) {
        console.error("[threedDrawing] cote commit failed", err);
      }
    }

    async function onTemplatelessClick(snap) {
      const { inProgress } = getLiveDrawing();

      if (behavior === "RECTANGLE") {
        if (inProgress.length === 0) {
          dispatch(pushDrawingVertex(toRectangleAnchor(snap)));
          dispatch(setRectHasFirstPoint(true));
          return;
        }
        const anchor = inProgress[0];
        // The corners previewed by the overlay (typed dimensions applied).
        const corners = getRectangleFrame()?.corners;
        if (!corners) return; // degenerate: stay armed
        releaseRectDims();
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
      // NB: while a length is typed the snap is always exactly that far from
      // `last`, so the double click / back-on-first-point closures cannot
      // trigger — Enter ends the path, as in 2D.
      if (last) releaseLengthConstraint();

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

    // "Coupe face" launched on a selected face: the cut is bound to it
    // (resolveFaceCutLockedFace — the overlays bound the drawing to the
    // same face). Read at cut time: the selection is cleared by the cut.
    function getFaceCutTarget() {
      const lock = resolveFaceCutLockedFace(store.getState(), editor);
      return lock
        ? {
            annotationId: lock.annotationId,
            faceIndex: lock.faceIndex,
            isMesh3d: lock.isMesh3d,
            displayedMesh: lock.displayed.mesh,
          }
        : null;
    }

    // "Coupe face": cut of the face the path lies on (the selected face
    // only when the tool was launched on one), whatever the outcome the
    // path is consumed and the tool stays armed.
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
          target: getFaceCutTarget(),
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
        baseMapGroup,
        getUserAxesWorldDirections(
          store.getState().threedEditor.axesSettings.yawDeg
        )
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
      releaseRectDims();
      return true;
    }

    // « Découpe horizontale / verticale » on a SURFACE host (lathe, shell…):
    // the plane previewed on the hovered piece is stored on the annotation
    // (cutSurfaceAlongPlaneService); the 3D build replays it.
    async function cutSurface(surfaceCut) {
      try {
        const result = await cutSurfaceAlongPlaneService({
          editor,
          ...surfaceCut,
          updateAnnotationFn: updateAnnotation,
        });
        console.log(
          `[threedDrawing] surface cut: ${result.kind}${result.annotationId ? ` ${result.annotationId}` : ""}`
        );
        if (result.kind === "NONE") {
          const message =
            noFaceCutByReasonS[result.reason] ??
            noFaceCutByReasonS.NOT_EDITABLE;
          dispatch(setToaster({ message, severity: "warning" }));
        }
      } catch (err) {
        console.error("[threedDrawing] surface cut failed", err);
        dispatch(
          setToaster({
            message: err?.message || faceCutFailedS,
            severity: "error",
          })
        );
      }
      finishCommit();
    }

    // « Découpe horizontale / verticale »: the line previewed on the hovered
    // face (FaceCutAxisOverlayThreed) cuts it.
    async function cutFaceAlongAxis() {
      const hover = getFaceCutAxisHover();
      if (hover?.surfaceCut) {
        lastAxisCutTimeRef.current = performance.now();
        await cutSurface(hover.surfaceCut);
        clearFaceCutHoverCache();
        return;
      }
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
    // POLYLINE templates commit as an OPEN polyline from 2 points — CLOSED
    // (3+ points) when the path came back on its first point.
    // `points`: the path when it changed in this same step (a `*N` appended
    // by Enter) — `inProgressPolyline` is this render's snapshot.
    async function commitInProgressAsAnnotation({
      closed = false,
      points = null,
    } = {}) {
      if (!hasTemplate()) {
        console.warn(
          "[threedDrawing] commit skipped: no armed POLYGON/POLYLINE template"
        );
        return false;
      }
      const na = newAnnotationRef.current;
      const pts = points ?? inProgressPolyline;
      try {
        let created = null;
        if (na.type === "POLYGON" && pts.length >= 3) {
          created = await commitFace(pts);
        } else if (na.type === "POLYLINE" && pts.length >= (closed ? 3 : 2)) {
          created = await commitPolyline(pts, { closeLine: closed });
        } else {
          console.warn(
            `[threedDrawing] commit skipped: ${na.type} needs ${
              na.type === "POLYGON" || closed ? 3 : 2
            }+ points (got ${pts.length})`
          );
        }
        if (created) {
          console.log(
            `[threedDrawing] annotation created: ${created.id} on baseMap ${created.baseMapId} (listing ${created.listingId})${created.isMesh3d ? " (mesh sheet)" : ""}`
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

    // Typed X / Y rectangle dimensions are consumed by the rectangle (or
    // dropped with it): back to the "click the 1st corner" state.
    function releaseRectDims() {
      dispatch(clearRectDims());
      dispatch(setRectHasFirstPoint(false));
    }

    // The typed segment length is consumed by the point just placed: the
    // next segment is free again (2D parity, InteractionLayer).
    function releaseLengthConstraint() {
      if (store.getState().mapEditor.constraintBuffer) {
        dispatch(clearConstraintBuffer());
      }
    }

    // Typed segment length (2D parity): digits / "." / "," feed
    // mapEditor.constraintBuffer (SectionSegmentLengthConstraint + the cursor badge),
    // DrawingOverlayThreed rescales the preview to it and the next click
    // consumes it. No ";" series in 3D (no collinear expansion here). Not
    // for rectangles (their second corner is the cursor). True when consumed.
    function onLengthKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (behavior === "RECTANGLE") return false;
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
      return false;
    }

    // T (2D parity, InteractionLayer): the last placed point of a line
    // becomes an arc point, or a corner again — DrawingOverlayThreed curves
    // the band through it, the commit keeps it as a "circle" point. Not
    // before the first point, nor for the disc / axis flows. True when
    // consumed.
    function onArcToggleKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (e.key !== "t" && e.key !== "T") return false;
      if (!isPolylineClickDraw() || isDiscDraw() || isAxisDraw()) return false;
      if (getLiveDrawing().inProgress.length === 0) return false;
      e.preventDefault();
      if (!e.repeat) dispatch(toggleLastDrawingVertexType());
      return true;
    }

    // Keys of « Répétition du motif »: "*" opens the count (only with a
    // pattern to repeat: one segment at least, not closed), then digits / Backspace / Escape act on it —
    // not on the typed length. Enter is left to the callers (validate, then
    // end the path). True when consumed.
    function onPatternRepeatKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (!isPatternRepeatDraw()) return false;
      if (e.key === "*") {
        if (getPatternSegmentCount(getLiveDrawing().inProgress) === 0) {
          return false;
        }
        e.preventDefault();
        dispatch(appendToPatternRepeatBuffer("*"));
        return true;
      }
      if (!store.getState().mapEditor.patternRepeatBuffer) return false;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        dispatch(appendToPatternRepeatBuffer(e.key));
        return true;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        dispatch(deleteLastPatternRepeatBuffer());
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dispatch(clearPatternRepeatBuffer());
        return true;
      }
      // No typed length while a repetition is pending.
      if (/^[.,;]$/.test(e.key)) {
        e.preventDefault();
        return true;
      }
      return false;
    }

    // Keys of « Découpe horizontale / verticale »: digits type the cut
    // distance (mapEditor.constraintBuffer, shown in SectionFaceCutAxisConstraint),
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

    // Keys of a rectangle once its anchor is placed (2D rectangle parity,
    // InteractionLayer): the letter of a side (X / Y / Z — the user axis it
    // runs along, as shown on its badge and in the bottom bar) targets its
    // dimension, digits type it, "-" flips its sign, Backspace erases.
    // Shared by the template, "Dessin" and "Coupe face" rectangles. True
    // when consumed.
    function onRectangleDimsKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const letter = e.key.length === 1 ? e.key.toUpperCase() : "";
      if (["X", "Y", "Z"].includes(letter)) {
        const sideAxes =
          getRectangleFrame()?.sideAxes ?? DEFAULT_RECT_SIDE_AXES;
        const side = sideAxes.indexOf(letter);
        // A letter of no side: X / Y are still consumed (they are rectangle
        // keys), Z is left to the other handlers.
        if (side < 0) {
          if (letter === "Z") return false;
          e.preventDefault();
          return true;
        }
        e.preventDefault();
        dispatch(setRectCurrentAxis(side === 0 ? "x" : "y"));
        dispatch(side === 0 ? setRectXBuffer("") : setRectYBuffer(""));
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
      return false;
    }

    // "Coupe face" rectangle keys: the dims keys above, plus Enter which
    // cuts with the typed dimensions (a missing one follows the cursor).
    // True when consumed.
    async function onFaceCutRectangleKey(e) {
      if (onRectangleDimsKey(e)) return true;
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
      // Orbit / pan around the point under the cursor: MainThreedEditor's
      // handlePointerDown stands aside while drawing (same pattern as the
      // brush). Prefer the snap shown under the marker — the point a click
      // would place — and fall back to the raycast under the cursor.
      const controlsManager = editor.sceneManager?.controlsManager;
      if (controlsManager?.isPivotGesture?.(e)) {
        const snapPosition = getLastSnap()?.position;
        if (snapPosition) controlsManager.setRotationPivot(snapPosition);
        else controlsManager.updateRotationPivotFromEvent?.(e);
      }
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
      // A pending `*N`: this click validates the repeated vertices only
      // (wherever it lands).
      if (
        isPatternRepeatDraw() &&
        store.getState().mapEditor.patternRepeatBuffer
      ) {
        if (isTemplatelessDraw()) await enqueue(applyPendingPatternRepeat);
        else applyPendingPatternRepeat();
        return;
      }
      if (!snap?.position) {
        console.warn("[threedDrawing] click ignored: no snap under cursor");
        return;
      }

      if (isCoteDraw()) {
        await enqueueClick(onCoteClick, snap, clickTime);
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
          dispatch(pushDrawingVertex(toRectangleAnchor(snap)));
          dispatch(setRectHasFirstPoint(true));
          return;
        }
        // Second click: auto-commit the 4 corners previewed by the overlay
        // (2D parity — the RECTANGLE behavior never falls through to face
        // detection).
        const anchor = inProgressPolyline[0];
        const frame = getRectangleFrame();
        const corners = frame?.corners;
        if (!corners) {
          console.warn(
            "[threedDrawing] rectangle 2nd click ignored: degenerate corners"
          );
          return; // stay armed
        }
        releaseRectDims();
        const na = newAnnotationRef.current;
        const vertices = corners.map((c) => ({
          x: c.x,
          y: c.y,
          z: c.z,
          ...(anchor.baseMapId ? { baseMapId: anchor.baseMapId } : {}),
        }));
        try {
          // A POLYLINE template off its plan (a vertical rectangle): the
          // polyline commit would collapse the corner pairs sharing a plan
          // position into a 2-point line — the face commit encodes it as a
          // band instead.
          const asFace = na.type === "POLYGON" || !frame.onBaseMap;
          const created = asFace
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

      // REVOLUTION_AXIS: the disc's two clicks — the centre must sit on a
      // HORIZONTAL base map plane (the axis is a plan row); the 2nd click
      // commits the axis and disarms the tool (one-shot, 2D parity).
      if (isAxisDraw()) {
        if (inProgressPolyline.length === 0) {
          if (!scopeId) {
            dispatch(
              setToaster({ message: axisNoScopeS, severity: "warning" })
            );
            return;
          }
          const horizontalBaseMaps = (baseMaps || []).filter(
            (bm) => bm.orientation !== "VERTICAL"
          );
          const centerBaseMapId =
            snap.baseMapId ??
            (snap.faceNormal
              ? null
              : (resolveBaseMapForPoint(snap.position, horizontalBaseMaps)
                  ?.baseMap?.id ?? null));
          const onHorizontalPlan =
            Boolean(centerBaseMapId) &&
            horizontalBaseMaps.some((bm) => bm.id === centerBaseMapId);
          if (!onHorizontalPlan) {
            dispatch(
              setToaster({ message: axisNotOnPlanS, severity: "warning" })
            );
            return;
          }
          dispatch(
            pushDrawingVertex(
              toDrawingVertex(snap, { baseMapId: centerBaseMapId })
            )
          );
          return;
        }
        const center = inProgressPolyline[0];
        const rim = snap.position;
        const radius = new Vector3(center.x, center.y, center.z).distanceTo(
          rim
        );
        if (!(radius > 1e-3)) return; // stay armed
        // The typed radius was applied to this point (preview snap): consumed.
        releaseLengthConstraint();
        try {
          const created = await commitAxis(center, {
            x: rim.x,
            y: rim.y,
            z: rim.z,
          });
          if (created) {
            console.log(
              `[threedDrawing] revolution axis created: ${created.id} on baseMap ${created.baseMapId}`
            );
            warnIfOffMainBaseMap(created);
            finishCommit();
            // One-shot tool (2D parity): clearing the 2D drawing state makes
            // the bridge close the 3D mode.
            dispatch(setEnabledDrawingMode(null));
            dispatch(setNewAnnotation({}));
          } else {
            console.warn("[threedDrawing] revolution axis commit refused", {
              hostId: center.baseMapId,
            });
          }
        } catch (err) {
          console.error("[threedDrawing] revolution axis commit failed", err);
        }
        return;
      }

      // DISC: 1st click = the centre (stamped with its plan, like a
      // rectangle anchor), 2nd click = a rim point on the centre's plane
      // (the overlay locks the plane and previews the circle) → commit.
      if (isDiscDraw()) {
        if (inProgressPolyline.length === 0) {
          dispatch(pushDrawingVertex(toRectangleAnchor(snap)));
          return;
        }
        const center = inProgressPolyline[0];
        const rim = snap.position;
        const radius = new Vector3(center.x, center.y, center.z).distanceTo(
          rim
        );
        if (!(radius > 1e-3)) return; // stay armed
        // The typed radius was applied to this point (preview snap): consumed.
        releaseLengthConstraint();
        try {
          const created = await commitDisc(center, {
            x: rim.x,
            y: rim.y,
            z: rim.z,
          });
          if (created) {
            console.log(
              `[threedDrawing] disc annotation created: ${created.id} on baseMap ${created.baseMapId} (listing ${created.listingId})`
            );
            warnIfOffMainBaseMap(created);
            finishCommit();
          }
        } catch (err) {
          console.error("[threedDrawing] disc commit failed", err);
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
      // Closure is explicit only (Enter / Escape, or a click back on the
      // first point): existing mesh vertices / edges never close the shape.
      const last = inProgressPolyline[inProgressPolyline.length - 1];
      if (last && isSamePoint(last, newVertex)) return; // no duplicate point
      // The typed length was applied to this point (preview snap): consumed.
      // NB: while locked the point is always exactly that far from `last`,
      // so the back-on-first-point closure below cannot trigger — Enter ends.
      if (last) releaseLengthConstraint();
      if (
        inProgressPolyline.length >= 3 &&
        isSamePoint(inProgressPolyline[0], newVertex)
      ) {
        // Back on the first point: the contour is closed. One that commits
        // nothing stays as drawn (Escape discards it).
        await commitInProgressAsAnnotation({ closed: true });
        return;
      }
      // "Segment (2 clics)": the 2nd click ends the segment (2D parity —
      // InteractionLayer commits POLYLINE_SEGMENT at 2 points). The path is
      // passed explicitly: `inProgressPolyline` is this render's snapshot.
      if (behavior === "SEGMENT" && inProgressPolyline.length >= 1) {
        const committed = await commitInProgressAsAnnotation({
          points: [...inProgressPolyline, newVertex],
        });
        if (!committed) dispatch(cancelInProgressPolyline());
        return;
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
      if (
        behavior === "RECTANGLE" &&
        inProgressPolyline.length === 1 &&
        onRectangleDimsKey(e)
      )
        return;
      if (onPatternRepeatKey(e)) return;
      if (onLengthKey(e)) return;
      if (onArcToggleKey(e)) return;
      if (isCoteDraw()) {
        // Keys never commit a cote (its 2nd click does). Escape drops the
        // 1st point, then the typed length, then leaves the tool (template
        // or template-less: clearing the 2D drawing state makes the bridge
        // close the 3D mode).
        if (e.key !== "Escape") return;
        if (inProgressPolyline.length > 0) {
          dispatch(cancelInProgressPolyline());
          return;
        }
        if (store.getState().mapEditor.constraintBuffer) {
          dispatch(clearConstraintBuffer());
          return;
        }
        dispatch(setEnabledDrawingMode(null));
        dispatch(setNewAnnotation({}));
        return;
      }
      if (isTemplatelessDraw()) {
        if (e.key === "Enter") {
          if (behavior === "RECTANGLE") return;
          await enqueue(async () => {
            // A pending `*N` is appended first, then the path ends.
            applyPendingPatternRepeat();
            const { inProgress } = getLiveDrawing();
            if (inProgress.length >= 2) await endPath(inProgress);
          });
        } else if (e.key === "Escape") {
          if (inProgressPolyline.length === 0) {
            // A typed length with nothing drawn: Escape only drops it (same
            // as the "Coupe face" axis).
            if (store.getState().mapEditor.constraintBuffer) {
              dispatch(clearConstraintBuffer());
              return;
            }
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
            if (behavior === "RECTANGLE") releaseRectDims();
          });
        }
        return;
      }
      if (e.key === "Enter") {
        // Rectangle / segment / disc / axis: keys never commit (2D parity —
        // the 2nd click does).
        if (
          behavior === "RECTANGLE" ||
          behavior === "SEGMENT" ||
          isDiscDraw() ||
          isAxisDraw()
        )
          return;
        // A pending `*N` is appended first, then the path ends.
        const repeatedPath = applyPendingPatternRepeat();
        const committed = await commitInProgressAsAnnotation({
          points: repeatedPath,
        });
        if (!committed) dispatch(flushInProgressAsTrait3D());
      } else if (e.key === "Escape") {
        if (inProgressPolyline.length > 0) {
          if (behavior === "RECTANGLE") {
            dispatch(cancelInProgressPolyline());
            releaseRectDims();
            return;
          }
          // Disc / axis: Escape drops the centre (nothing committable yet).
          if (isDiscDraw() || isAxisDraw()) {
            dispatch(cancelInProgressPolyline());
            return;
          }
          // 2D parity: Escape mid-drawing commits too; an uncommittable
          // polyline (too few points, no template...) is discarded instead.
          const committed = await commitInProgressAsAnnotation();
          if (!committed) dispatch(cancelInProgressPolyline());
          return;
        }
        // A typed length with nothing drawn: Escape only drops it.
        if (store.getState().mapEditor.constraintBuffer) {
          dispatch(clearConstraintBuffer());
          return;
        }
        const na = newAnnotationRef.current;
        if (na?.annotationTemplateId || isAxisDraw()) {
          // Template-driven mode (or the template-less axis), nothing in
          // progress: exit entirely by clearing the 2D drawing state (the
          // bridge deactivates the mode).
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
    baseMaps,
    mainBaseMapId,
    projectId,
    scopeId,
    listingId,
    enabledDrawingMode,
    dispatch,
  ]);
}
