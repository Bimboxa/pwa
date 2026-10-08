import { useEffect, useRef } from "react";

import { useSelector, useStore } from "react-redux";
import { Group, Plane, Raycaster, Vector2, Vector3 } from "three";

import formatSegmentLengthDisplay from "Features/annotations/utils/formatSegmentLengthDisplay";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools";
import SEGMENT_DRAWING_MODES from "Features/mapEditor/constants/segmentDrawingModes";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import segmentLengthPxRef from "Features/mapEditor/state/segmentLengthPxRef";
import parseConstraintLengths from "Features/mapEditor/utils/parseConstraintLengths";
import DrawingLengthBadge from "Features/mapEditorGeneric/components/DrawingLengthBadge";
import intersectBaseMapPlane from "Features/threedBaseMapMove/utils/intersectBaseMapPlane";
import findNearestEdgeSnap from "Features/threedDimensions/utils/findNearestEdgeSnap";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  isFaceCutAxisMode,
  isFaceCutDrawingMode,
} from "Features/threedFaceCut/utils/faceCutTools";
import getFaceCutBasisWorld from "Features/threedFaceCut/utils/getFaceCutBasisWorld";
import resolveFaceCutLockedFace, {
  intersectLockedFace,
} from "Features/threedFaceCut/utils/resolveFaceCutLockedFace";
import parseRectBuffer from "Features/mapEditor/utils/parseRectBuffer";
import { isMeshBrushDrawingMode } from "Features/meshPaint/utils/meshBrushTools";

import useVertexSnap from "../hooks/useVertexSnap";
import { setLastSnap } from "../services/lastSnapStore";
import { getMeshAdjacency } from "../services/meshGraphStore";
import applyFixedLengthConstraint3d from "../utils/applyFixedLengthConstraint3d";
import computeRectangleCorners from "../utils/computeRectangleCorners";
import computeRectangleCornersOnPlane from "../utils/computeRectangleCornersOnPlane";
import computeSnapTarget from "../utils/computeSnapTarget";
import intersectAnnotationFace, {
  buildFacePlaneHit,
} from "../utils/intersectAnnotationFace";
import { isTemplatelessDraft } from "../utils/templateFaceDrawSelectors";
import intersectScene3d from "Features/scene3d/services/intersectScene3d";
import usePrepareScene3dPicking from "Features/scene3d/hooks/usePrepareScene3dPicking";
import buildDrawingVertexMarkers from "../utils/buildDrawingVertexMarkers";
import {
  buildConnectedPolyline,
  buildSegments,
  disposeObject,
  getCanvasResolution,
  getDashSize,
  makeLineMaterial,
} from "../utils/drawingOverlayLines";

const COLOR_VERTEX = 0xff2d8d;
const COLOR_EDGE = 0x2e7d32;
const COLOR_PLANE = 0x1565c0;
// In-plane ortho / vertex-alignment lock — the 2D axis-snap active red.
const COLOR_LOCK = 0xff1744;
const COLOR_AXIS_X = 0xff3b30;
const COLOR_AXIS_Y = 0x34c759;
const COLOR_AXIS_Z = 0x007aff;
const COLOR_FREE = 0x000000;
const COLOR_IN_PROGRESS = 0xff2d8d;
const COLOR_TRAIT = 0x8a8a8a;
const COLOR_CROSS = "#90a4ae";
// Marker of an aligned vertex — the active marker of the 2D AxisSnapLayer.
const ALIGN_MARKER_FILL = "rgba(255,23,68,0.45)";
// A lock on each arm of the cross at most.
const ALIGN_MARKERS_COUNT = 2;
// Under this distance (m) to the hovered plane, an aligned vertex sits on its
// own footprint: no leader line.
const ALIGN_LEADER_EPS_M = 5e-3;

const LINEWIDTH_PREVIEW = 3;
const LINEWIDTH_IN_PROGRESS = 4;
const LINEWIDTH_TRAIT = 3;

// Pixel radius of the snap-helper circle, matching the 2D SnappingLayer.
const SNAP_CIRCLE_RADIUS_PX = 6;
// Rectangle preview: screen px between a side's midpoint and its length
// badge, outside the rectangle (2D InteractionLayer parity).
const RECT_DIM_BADGE_OFFSET_PX = 22;
const SNAP_CIRCLE_STROKE_PX = 2;

function colorForKind(kind) {
  switch (kind) {
    case "AXIS_X":
      return COLOR_AXIS_X;
    case "AXIS_Y":
      return COLOR_AXIS_Y;
    case "AXIS_Z":
      return COLOR_AXIS_Z;
    case "EDGE":
      return COLOR_EDGE;
    case "PLANE":
    case "FACE":
    case "SCAN":
      return COLOR_PLANE;
    case "PLANE_ORTHO":
    case "PLANE_ALIGN":
      return COLOR_LOCK;
    case "FREE":
      return COLOR_FREE;
    case "VERTEX":
    default:
      return COLOR_VERTEX;
  }
}

// Preview line color: the lock color as soon as an arm of the cross is
// locked (e.g. an edge snap stopped on the ortho from the last vertex).
function colorForSnap(snap) {
  if (snap?.lockedAxes?.A || snap?.lockedAxes?.B) return COLOR_LOCK;
  return colorForKind(snap?.kind);
}

function colorHex(c) {
  return `#${c.toString(16).padStart(6, "0")}`;
}

// Renders the 3D drawing overlay:
//   - persistent trait3D wireframe + in-progress polyline + dashed preview
//     segment, all using Line2/LineSegments2 with screen-space pixel
//     thickness via LineMaterial
//   - a fixed-pixel-size SVG snap circle overlaid on the canvas (mirrors
//     the 2D SnappingLayer pattern)
export default function DrawingOverlayThreed() {
  const store = useStore();
  // « Pinceau »: the drawing mode is on (bridge guards) but nothing is drawn
  // — no overlay, no vertex snap index, no scan picking preparation. Same
  // for the "Coupe face" axis cuts: FaceCutAxisOverlayThreed hovers the
  // face itself, no vertex is drawn.
  const active = useSelector(
    (s) =>
      s.threedEditor.drawingMode.active &&
      !isMeshBrushDrawingMode(s.mapEditor.enabledDrawingMode) &&
      !isFaceCutAxisMode(s.mapEditor.enabledDrawingMode)
  );
  const inProgressPolyline = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline
  );
  const trait3DSegments = useSelector(
    (s) => s.threedEditor.drawingMode.trait3DSegments
  );
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  // Template-less drawing ("Dessin" tool in 3D) and "Coupe face": points
  // also land on annotation faces.
  const isMeshDraw = useSelector(
    (s) =>
      isTemplatelessDraft(s.annotations.newAnnotation) ||
      isFaceCutDrawingMode(s.mapEditor.enabledDrawingMode)
  );

  const baseMaps = useBaseMaps()?.value;
  const mainBaseMap = useMainBaseMap();
  const mainBaseMapId = mainBaseMap?.id;
  // The bottom bar reads the live length as image px × meterByPx: the 3D
  // length (metres) is fed back through that scale.
  const meterByPx = mainBaseMap?.meterByPx;
  // Typed segment length (digits, see useDrawingPointerHandlers): the
  // preview snap is rescaled to it on the next move — and right away through
  // the rerun effect below.
  const constraintBuffer = useSelector((s) => s.mapEditor.constraintBuffer);
  // Typed X / Y dimensions of a rectangle (template, "Dessin" or "Coupe
  // face") and the axis being typed: the preview and its side badges follow
  // them (re-run of the pointer-move effect, which reads the store).
  const rectDimsKey = useSelector((s) =>
    getDrawingToolByKey(s.mapEditor.enabledDrawingMode)?.behavior ===
    "RECTANGLE"
      ? `${s.mapEditor.rectXBuffer}|${s.mapEditor.rectYBuffer}|${s.mapEditor.rectCurrentAxis}`
      : ""
  );

  const { findNearestSnap } = useVertexSnap({ active });
  // Lines (a POLYLINE template, or the "Dessin" tool on its line type) can
  // land their points on the scan base maps: straight segments between the
  // picked points. Not the polygons — a face needs coplanar points.
  const canDrawOnScan = useSelector(
    (s) => s.annotations.newAnnotation?.type === "POLYLINE"
  );
  usePrepareScene3dPicking(active && canDrawOnScan);

  const rootRef = useRef(null);
  const traitLinesRef = useRef(null);
  const inProgressLinesRef = useRef(null);
  const inProgressMarkersRef = useRef(null);
  const previewLineRef = useRef(null);
  const snapCircleRef = useRef(null);
  const crossARef = useRef(null);
  const crossBRef = useRef(null);
  const alignMarkerRefs = useRef([]);
  const alignLeaderRefs = useRef([]);
  const badgeRef = useRef(null);
  // X / Y badges of the two rectangle sides adjacent to the cursor corner.
  const rectDimBadgeRefs = useRef([]);
  // Last pointer position + a re-run of the hover from it, so a typed length
  // moves the preview without a mouse move (FaceCutAxisOverlayThreed pattern).
  const lastClientRef = useRef(null);
  const rerunRef = useRef(null);

  // mount / unmount root group
  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const scene = editor?.sceneManager?.scene;
    if (!scene) return;

    const root = new Group();
    root.name = "DrawingOverlayThreed";
    scene.add(root);
    rootRef.current = root;
    editor.sceneManager.renderScene?.();

    return () => {
      scene.remove(root);
      disposeObject(root);
      rootRef.current = null;
      traitLinesRef.current = null;
      inProgressLinesRef.current = null;
      inProgressMarkersRef.current = null;
      previewLineRef.current = null;
      // No stale snap for the next tool's click.
      setLastSnap(null);
      editor.sceneManager.renderScene?.();
    };
  }, [active]);

  // sync persistent trait3DSegments
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (traitLinesRef.current) {
      root.remove(traitLinesRef.current);
      disposeObject(traitLinesRef.current);
      traitLinesRef.current = null;
    }
    if (trait3DSegments.length) {
      const editor = getActiveThreedEditor();
      const mat = makeLineMaterial({
        color: COLOR_TRAIT,
        linewidth: LINEWIDTH_TRAIT,
        resolution: getCanvasResolution(editor),
      });
      const lines = buildSegments(trait3DSegments, mat);
      if (lines) {
        lines.renderOrder = 999;
        root.add(lines);
        traitLinesRef.current = lines;
      }
    }
    getActiveThreedEditor()?.sceneManager?.renderScene?.();
  }, [trait3DSegments, active]);

  // sync in-progress polyline (committed segments only) + a dot on every
  // placed point — the feedback of a click (a lone first point has no
  // segment yet)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (inProgressLinesRef.current) {
      root.remove(inProgressLinesRef.current);
      disposeObject(inProgressLinesRef.current);
      inProgressLinesRef.current = null;
    }
    if (inProgressMarkersRef.current) {
      root.remove(inProgressMarkersRef.current);
      disposeObject(inProgressMarkersRef.current);
      inProgressMarkersRef.current = null;
    }
    const markers = buildDrawingVertexMarkers(
      inProgressPolyline,
      COLOR_IN_PROGRESS
    );
    if (markers) {
      markers.renderOrder = 1001;
      root.add(markers);
      inProgressMarkersRef.current = markers;
    }
    if (inProgressPolyline.length >= 2) {
      const editor = getActiveThreedEditor();
      const mat = makeLineMaterial({
        color: COLOR_IN_PROGRESS,
        linewidth: LINEWIDTH_IN_PROGRESS,
        resolution: getCanvasResolution(editor),
      });
      const line = buildConnectedPolyline(inProgressPolyline, mat);
      if (line) {
        line.renderOrder = 1000;
        root.add(line);
        inProgressLinesRef.current = line;
      }
    }
    getActiveThreedEditor()?.sceneManager?.renderScene?.();
  }, [inProgressPolyline, active]);

  // pointer-move: snap detection + hover marker + plane cross + alignment
  // markers (SVG, screen-space) + dashed preview segment or rectangle loop
  // (Line2 with thick LineMaterial)
  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    const camera = editor?.sceneManager?.camera;
    if (!dom || !camera) return;

    const ndc = new Vector2();

    // RECTANGLE behavior: the first committed vertex is the anchor; the
    // cursor then previews the axis-aligned rectangle on the anchor's plan.
    const behavior = getDrawingToolByKey(enabledDrawingMode)?.behavior;
    const anchor =
      behavior === "RECTANGLE" && inProgressPolyline.length >= 1
        ? inProgressPolyline[0]
        : null;
    // A rectangle anchored on an annotation face (mesh drawing) lives on
    // that face's plane; otherwise on the anchor's base map plane.
    const anchorNormal = anchor?.faceNormal
      ? new Vector3(
          anchor.faceNormal.x,
          anchor.faceNormal.y,
          anchor.faceNormal.z
        )
      : null;
    const anchorHost =
      !anchorNormal && anchor?.baseMapId
        ? (baseMaps || []).find((b) => b.id === anchor.baseMapId)
        : null;
    const anchorPlane = anchorNormal
      ? new Plane().setFromNormalAndCoplanarPoint(
          anchorNormal,
          new Vector3(anchor.x, anchor.y, anchor.z)
        )
      : null;
    const raycaster = new Raycaster();
    const traitPoints = trait3DSegments.flatMap((seg) => [seg.a, seg.b]);

    // "Coupe face" launched on a selected face: the drawing is bound to that
    // face (resolveFaceCutLockedFace) — re-resolved on every move, the
    // displayed object may be rebuilt meanwhile.
    const canLockFace = isFaceCutDrawingMode(enabledDrawingMode);
    let faceLock = null;

    // "Coupe face" rectangle: the face's frame (getFaceCutBasisWorld) and
    // the typed X / Y dimensions, as the click commits them.
    const faceCutBasis =
      isFaceCutDrawingMode(enabledDrawingMode) && anchorNormal
        ? getFaceCutBasisWorld(
            anchorNormal,
            anchor,
            editor.sceneManager?.imagesManager?.getGroup?.(anchor.baseMapId) ??
              null
          )
        : null;

    // Typed X / Y dimensions replace the cursor's (2D parity), whatever the
    // rectangle's host: a face frame ("Coupe face"), a face plane ("Dessin")
    // or a base map plane (template).
    function getRectangleCorners(position) {
      const { rectXBuffer, rectYBuffer } = store.getState().mapEditor;
      const forcedX = parseRectBuffer(rectXBuffer);
      const forcedY = parseRectBuffer(rectYBuffer);
      if (anchorNormal) {
        return computeRectangleCornersOnPlane(anchor, position, anchorNormal, {
          forcedDu: forcedX,
          forcedDv: forcedY,
          basis: faceCutBasis,
        });
      }
      if (anchorHost)
        return computeRectangleCorners(anchor, position, anchorHost, {
          forcedDx: forcedX,
          forcedDy: forcedY,
        });
      return null;
    }

    // Plane under the cursor, in the shape computeSnapTarget expects.
    function intersectPlane(mNdc) {
      if (anchorPlane) {
        // Second corner of a face-anchored rectangle: the anchor's plane.
        raycaster.setFromCamera(mNdc, camera);
        const hit = raycaster.ray.intersectPlane(anchorPlane, new Vector3());
        return hit
          ? buildFacePlaneHit(hit, anchorNormal, {
              nodeId: anchor.nodeId,
              baseMapId: anchor.baseMapId,
            })
          : null;
      }
      if (faceLock) {
        // Bound to the selected face: its plane, and only where the cursor
        // is on the face — no base map, other face or scan.
        const hit = intersectLockedFace(
          faceLock,
          mNdc,
          camera,
          editor.sceneManager
        );
        if (!hit?.inside) return null;
        return buildFacePlaneHit(hit.position, hit.normal, {
          nodeId: faceLock.annotationId,
          baseMapId: faceLock.baseMapId,
          distance: hit.distance,
        });
      }
      const planHit = intersectBaseMapPlane(
        editor,
        mNdc,
        camera,
        // Stacked unplaced base maps are coplanar at the origin — prefer
        // the 2D-selected one so the drawing lands on the plan the user
        // is looking at (and will look for) in 2D.
        anchor
          ? { onlyBaseMapId: anchor.baseMapId }
          : { preferredBaseMapId: mainBaseMapId }
      );
      // The nearest surface under the cursor wins.
      let best = planHit;
      let bestDistance = planHit
        ? camera.position.distanceTo(planHit.position)
        : Infinity;
      // Template-less drawing: an annotation face in front of the plan. A sheet
      // lying on the plan is in front of it by its 1 mm lift only.
      if (isMeshDraw && !anchor) {
        const faceHit = intersectAnnotationFace(editor, mNdc, camera);
        if (faceHit && faceHit.distance <= bestDistance + 2e-3) {
          best = faceHit;
          bestDistance = faceHit.distance;
        }
      }
      // Line drawing: a scan base map in front takes the point (on its
      // surface). Not for rectangles (they live on a plane).
      if (canDrawOnScan && behavior !== "RECTANGLE") {
        const scanHit = intersectScene3d(editor, mNdc, camera);
        if (scanHit?.isPending) return scanHit;
        if (scanHit && scanHit.distance < bestDistance) {
          // Same target as a face / plan hit: the cross lies in the plane of
          // the triangle under the cursor. Its arms grow with the viewing
          // distance — a scan is looked at from much farther than a face.
          best = {
            ...buildFacePlaneHit(
              scanHit.position,
              scanHit.normal,
              { baseMapId: scanHit.baseMapId, distance: scanHit.distance },
              Math.max(0.5, scanHit.distance * 0.04)
            ),
            isFace: false,
            isScan: true,
          };
        }
      }
      return best;
    }

    function toScreen(worldPos, rect) {
      const projected = worldPos.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) return null;
      return {
        sx: ((projected.x + 1) / 2) * rect.width,
        sy: ((1 - projected.y) / 2) * rect.height,
      };
    }

    function updateSnapCircle(snap, rect) {
      const circle = snapCircleRef.current;
      if (!circle) return;
      const screen = snap?.position ? toScreen(snap.position, rect) : null;
      if (!screen) {
        circle.style.display = "none";
        return;
      }
      circle.setAttribute("cx", screen.sx);
      circle.setAttribute("cy", screen.sy);
      circle.style.stroke = colorHex(colorForKind(snap.kind));
      circle.style.display = "block";
    }

    // Cross helper of a plane hit: the two dashed lines through the point,
    // parallel to the plane's edges, ending on its borders (mirrors
    // MoveBaseMapOverlayThreed). A locked arm (in-plane ortho lock, or arm
    // running through an aligned vertex) is drawn solid in the lock color —
    // like the snapped branch of the 2D cursor.
    function updateCross(snap, rect) {
      const show = Boolean(snap?.axisA && snap?.axisB);
      [
        [crossARef, snap?.axisA, "A"],
        [crossBRef, snap?.axisB, "B"],
      ].forEach(([ref, axis, key]) => {
        const el = ref.current;
        if (!el) return;
        const a = show ? toScreen(axis[0], rect) : null;
        const b = show ? toScreen(axis[1], rect) : null;
        if (!a || !b) {
          el.style.display = "none";
          return;
        }
        el.setAttribute("x1", a.sx);
        el.setAttribute("y1", a.sy);
        el.setAttribute("x2", b.sx);
        el.setAttribute("y2", b.sy);
        const locked = Boolean(snap.lockedAxes?.[key]);
        el.style.stroke = locked ? colorHex(COLOR_LOCK) : COLOR_CROSS;
        if (locked) el.removeAttribute("stroke-dasharray");
        else el.setAttribute("stroke-dasharray", "5 4");
        el.style.display = "block";
      });
    }

    // Vertices the cross is aligned with: a marker on each of them, plus a
    // dashed leader down to its footprint when it is off the hovered plane
    // (e.g. a wall-top vertex) — the locked arm runs through the footprint.
    function updateAlignMarkers(snap, rect) {
      const vertices = snap?.alignFrom ?? [];
      for (let i = 0; i < ALIGN_MARKERS_COUNT; i++) {
        const marker = alignMarkerRefs.current[i];
        const leader = alignLeaderRefs.current[i];
        const vertex = vertices[i];
        const at = vertex ? toScreen(vertex.position, rect) : null;
        if (marker) {
          if (at) {
            marker.setAttribute("cx", at.sx);
            marker.setAttribute("cy", at.sy);
          }
          marker.style.display = at ? "block" : "none";
        }
        if (!leader) continue;
        const isOffPlane =
          at &&
          vertex.position.distanceTo(vertex.footprint) > ALIGN_LEADER_EPS_M;
        const foot = isOffPlane ? toScreen(vertex.footprint, rect) : null;
        if (foot) {
          leader.setAttribute("x1", at.sx);
          leader.setAttribute("y1", at.sy);
          leader.setAttribute("x2", foot.sx);
          leader.setAttribute("y2", foot.sy);
        }
        leader.style.display = foot ? "block" : "none";
      }
    }

    function clearPreviewLine() {
      if (previewLineRef.current) {
        rootRef.current?.remove(previewLineRef.current);
        disposeObject(previewLineRef.current);
        previewLineRef.current = null;
      }
    }

    function updatePreviewLine(snap) {
      const root = rootRef.current;
      if (!root) return;
      clearPreviewLine();
      const last = inProgressPolyline[inProgressPolyline.length - 1];
      const snapPos = snap?.position;
      if (!snapPos || !last) return;

      const mat = makeLineMaterial({
        color: colorForSnap(snap),
        linewidth: LINEWIDTH_PREVIEW,
        dashed: true,
        dashSize: getDashSize(camera.position.distanceTo(snapPos)),
        resolution: getCanvasResolution(editor),
      });
      const line = buildSegments(
        [{ a: { x: last.x, y: last.y, z: last.z }, b: snapPos }],
        mat
      );
      if (line) {
        line.renderOrder = 1002;
        root.add(line);
        previewLineRef.current = line;
      }
    }

    function hideRectDimBadges() {
      rectDimBadgeRefs.current.forEach((b) => b?.hide());
    }

    // Side lengths (metres) of the two sides adjacent to the corner under
    // the cursor, as badges at their midpoint pushed outside the rectangle
    // (away from its screen centre). Corners come in A, B, C, D order with
    // A→B along the first axis: sides AB / CD are the typed X, BC / DA the
    // typed Y. Mirrors the 2D InteractionLayer.handleRectanglePreview.
    function updateRectDimBadges(corners, cursorPos, rect) {
      if (!corners || corners.length !== 4) {
        hideRectDimBadges();
        return;
      }
      const { rectXBuffer, rectYBuffer, rectCurrentAxis } =
        store.getState().mapEditor;
      const buffers = { x: rectXBuffer, y: rectYBuffer };
      let nearest = 0;
      let nearestDist = Infinity;
      corners.forEach((c, i) => {
        const d = c.distanceToSquared(cursorPos);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      });
      const prevIdx = (nearest + 3) % 4;
      const centerWorld = corners[0]
        .clone()
        .add(corners[2])
        .multiplyScalar(0.5);
      const center = toScreen(centerWorld, rect);
      // [start corner index of the side, start corner, end corner]
      [
        [prevIdx, corners[prevIdx], corners[nearest]],
        [nearest, corners[nearest], corners[(nearest + 1) % 4]],
      ].forEach(([startIdx, p, q], i) => {
        const badge = rectDimBadgeRefs.current[i];
        if (!badge) return;
        const mid = toScreen(p.clone().add(q).multiplyScalar(0.5), rect);
        if (!mid || !center) {
          badge.hide();
          return;
        }
        const axis = startIdx % 2 === 0 ? "x" : "y";
        const ox = mid.sx - center.sx;
        const oy = mid.sy - center.sy;
        const od = Math.hypot(ox, oy) || 1;
        const { value, unit } = formatSegmentLengthDisplay({
          meters: p.distanceTo(q),
          meterByPx: 1,
        });
        const buffer = buffers[axis] || "";
        const label = axis.toUpperCase();
        badge.update({
          x: mid.sx + (ox / od) * RECT_DIM_BADGE_OFFSET_PX,
          y: mid.sy + (oy / od) * RECT_DIM_BADGE_OFFSET_PX,
          text: buffer
            ? `${label} ${buffer} ${unit}`
            : `${label} ${value} ${unit}`,
          locked: buffer.length > 0,
          active: rectCurrentAxis === axis,
          anchor: "center",
        });
      });
    }

    function updateRectanglePreview(snap, rect) {
      const root = rootRef.current;
      if (!root) return;
      clearPreviewLine();
      if (!snap?.position || !anchor) {
        hideRectDimBadges();
        return;
      }
      const corners = getRectangleCorners(snap.position);
      updateRectDimBadges(corners, snap.position, rect);
      if (!corners) return;
      const mat = makeLineMaterial({
        color: colorForSnap(snap),
        linewidth: LINEWIDTH_PREVIEW,
        dashed: true,
        resolution: getCanvasResolution(editor),
      });
      const line = buildConnectedPolyline([...corners, corners[0]], mat);
      if (line) {
        line.renderOrder = 1002;
        root.add(line);
        previewLineRef.current = line;
      }
    }

    // The snap and the last vertex must sit on the same host for the typed
    // length to keep the point on it: same base map plane, same face
    // (normal), or the locked "Coupe face" face. A snap with no host
    // information (vertex of another object, FREE / world axis) is allowed —
    // refusing would make the lock flicker as the cursor crosses vertices.
    function sharesHost(snap, last) {
      if (faceLock) return true;
      if (snap.baseMapId && last.baseMapId) {
        return snap.baseMapId === last.baseMapId;
      }
      if (snap.faceNormal && last.faceNormal) {
        const a = snap.faceNormal;
        const b = last.faceNormal;
        return a.x * b.x + a.y * b.y + a.z * b.z > 0.999;
      }
      return true;
    }

    // Typed length (mapEditor.constraintBuffer): the snap only gives the
    // direction from the last vertex, the typed value gives the distance
    // (2D parity: applyFixedLengthConstraint). Never on a scan (not a
    // plane). The point no longer sits on the snapped vertex / edge, so its
    // identity and alignment helpers are dropped: it is an independent
    // point, drawn with the plane colour. Null when the lock does not apply.
    function constrainSnapToLength(snap, last, lengthM) {
      if (!snap?.position || snap.kind === "SCAN" || snap.isScan) return null;
      if (!sharesHost(snap, last)) return null;
      const position = applyFixedLengthConstraint3d({
        last,
        candidate: snap.position,
        lengthM,
      });
      const kind =
        snap.kind === "VERTEX" || snap.kind === "EDGE" ? "PLANE" : snap.kind;
      const next = { ...snap, position, kind, lengthLocked: true };
      delete next.meshKey;
      delete next.axisA;
      delete next.axisB;
      delete next.alignFrom;
      return next;
    }

    // Live length of the segment being drawn: the badge next to the cursor
    // and the bottom bar (segmentLengthPxRef). Locked: the badge shows the
    // raw typed buffer like the bottom bar, so "2." stays readable.
    function updateLengthBadge(snap, last, e, rect, locked) {
      const badge = badgeRef.current;
      if (
        !last ||
        !snap?.position ||
        !SEGMENT_DRAWING_MODES.includes(enabledDrawingMode)
      ) {
        segmentLengthPxRef.current = 0;
        badge?.hide();
        return;
      }
      const meters = new Vector3(last.x, last.y, last.z).distanceTo(
        snap.position
      );
      const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
      segmentLengthPxRef.current = hasScale ? meters / meterByPx : 0;
      if (!badge) return;
      // The scene is in metres whatever the main base map's scale.
      const { value, unit } = formatSegmentLengthDisplay({
        meters,
        meterByPx: 1,
      });
      const text = locked
        ? `${store.getState().mapEditor.constraintBuffer} ${unit}`
        : `${value} ${unit}`;
      badge.update({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        text,
        locked,
      });
    }

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };
      lastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
      faceLock = canLockFace
        ? resolveFaceCutLockedFace(store.getState(), editor)
        : null;
      const rawSnap = computeSnapTarget({
        mouseNdc: ndc,
        camera,
        canvasSize,
        // While a rectangle anchor is set, the lastVertex-anchored modes
        // (AXIS / FREE / ortho) and the snap back onto the anchor itself are
        // meaningless — the second corner lives on the anchor's plan.
        lastVertex: anchor
          ? undefined
          : inProgressPolyline[inProgressPolyline.length - 1],
        // Template-less drawing / face cut: the ends of the traits already
        // drawn are snap targets too.
        inProgressPolyline: anchor
          ? []
          : isMeshDraw
            ? [...traitPoints, ...inProgressPolyline]
            : inProgressPolyline,
        findNearestVertex: (mNdc, cam, sz, options) =>
          findNearestSnap(mNdc, cam, sz, undefined, options),
        findNearestEdge: (mNdc, cam, sz, options) =>
          findNearestEdgeSnap(
            getMeshAdjacency(),
            mNdc,
            cam,
            sz,
            undefined,
            options
          ),
        intersectPlane,
        alignAdjacency: getMeshAdjacency(),
        attachFaceToPointSnaps: isMeshDraw && !anchor,
        lockedPlane: faceLock?.planeWorld ?? null,
      });
      // Typed length: the rubber band (and the click, through lastSnap) is
      // rescaled from the last vertex. Not for rectangles (second corner).
      const last = anchor
        ? null
        : inProgressPolyline[inProgressPolyline.length - 1];
      const lockedLength = last
        ? (parseConstraintLengths(store.getState().mapEditor.constraintBuffer)
            ?.lengths[0] ?? null)
        : null;
      const constrained = lockedLength
        ? constrainSnapToLength(rawSnap, last, lockedLength)
        : null;
      const snap = constrained ?? rawSnap;
      setLastSnap(snap);
      updateSnapCircle(snap, rect);
      updateCross(snap, rect);
      updateAlignMarkers(snap, rect);
      if (anchor) {
        updateRectanglePreview(snap, rect);
      } else {
        hideRectDimBadges();
        updatePreviewLine(snap);
      }
      updateLengthBadge(snap, last, e, rect, Boolean(constrained));
      editor.sceneManager.renderScene?.();
    }

    function onPointerLeave() {
      setLastSnap(null);
      lastClientRef.current = null;
      segmentLengthPxRef.current = 0;
      badgeRef.current?.hide();
      hideRectDimBadges();
      if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
      if (crossARef.current) crossARef.current.style.display = "none";
      if (crossBRef.current) crossBRef.current.style.display = "none";
      [...alignMarkerRefs.current, ...alignLeaderRefs.current].forEach((el) => {
        if (el) el.style.display = "none";
      });
      clearPreviewLine();
      editor.sceneManager.renderScene?.();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    rerunRef.current = () => {
      if (lastClientRef.current) onPointerMove(lastClientRef.current);
    };
    return () => {
      rerunRef.current = null;
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [
    active,
    findNearestSnap,
    inProgressPolyline,
    trait3DSegments,
    enabledDrawingMode,
    baseMaps,
    mainBaseMapId,
    isMeshDraw,
    canDrawOnScan,
    rectDimsKey,
    store,
    meterByPx,
  ]);

  // Typed length changed (digit / Backspace / consumed by a click): re-run
  // the hover from the last pointer position so the rubber band and the
  // badge follow the typing without a mouse move. Declared after the
  // pointer-move effect: on a click, pushDrawingVertex + clearConstraintBuffer
  // are batched, the effect above re-closes over the new vertex first, then
  // this one redraws the free preview from it.
  useEffect(() => {
    rerunRef.current?.();
  }, [constraintBuffer]);

  if (!active) return null;
  return (
    <>
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        <line
          ref={crossARef}
          stroke={COLOR_CROSS}
          strokeWidth="1.5"
          strokeDasharray="5 4"
          style={{ display: "none" }}
        />
        <line
          ref={crossBRef}
          stroke={COLOR_CROSS}
          strokeWidth="1.5"
          strokeDasharray="5 4"
          style={{ display: "none" }}
        />
        {Array.from({ length: ALIGN_MARKERS_COUNT }).map((_, i) => (
          <line
            key={`leader-${i}`}
            ref={(el) => (alignLeaderRefs.current[i] = el)}
            stroke={colorHex(COLOR_LOCK)}
            strokeWidth="1.5"
            strokeDasharray="5 4"
            style={{ display: "none" }}
          />
        ))}
        {Array.from({ length: ALIGN_MARKERS_COUNT }).map((_, i) => (
          <circle
            key={`marker-${i}`}
            ref={(el) => (alignMarkerRefs.current[i] = el)}
            r={SNAP_CIRCLE_RADIUS_PX}
            stroke={colorHex(COLOR_LOCK)}
            strokeWidth="1.5"
            fill={ALIGN_MARKER_FILL}
            style={{ display: "none" }}
          />
        ))}
        <circle
          ref={snapCircleRef}
          r={SNAP_CIRCLE_RADIUS_PX}
          strokeWidth={SNAP_CIRCLE_STROKE_PX}
          fill="none"
          style={{ display: "none" }}
        />
      </svg>
      {/* Length of the segment being drawn, next to the cursor (imperative,
        see updateLengthBadge) */}
      <DrawingLengthBadge ref={badgeRef} />
      {/* Rectangle preview: X / Y side lengths (see updateRectDimBadges) */}
      {[0, 1].map((i) => (
        <DrawingLengthBadge
          key={`rect-dim-${i}`}
          ref={(el) => (rectDimBadgeRefs.current[i] = el)}
        />
      ))}
    </>
  );
}
