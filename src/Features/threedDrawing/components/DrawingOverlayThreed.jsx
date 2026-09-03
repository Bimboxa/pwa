import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Group, Vector2 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import intersectBaseMapPlane from "Features/threedBaseMapMove/utils/intersectBaseMapPlane";
import findNearestEdgeSnap from "Features/threedDimensions/utils/findNearestEdgeSnap";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import useVertexSnap from "../hooks/useVertexSnap";
import { setLastSnap } from "../services/lastSnapStore";
import { getMeshAdjacency } from "../services/meshGraphStore";
import computeRectangleCorners from "../utils/computeRectangleCorners";
import computeSnapTarget from "../utils/computeSnapTarget";

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

const LINEWIDTH_PREVIEW = 3;
const LINEWIDTH_IN_PROGRESS = 4;
const LINEWIDTH_TRAIT = 3;

// Pixel radius of the snap-helper circle, matching the 2D SnappingLayer.
const SNAP_CIRCLE_RADIUS_PX = 6;
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

function colorHex(c) {
  return `#${c.toString(16).padStart(6, "0")}`;
}

function disposeObject(obj) {
  if (!obj) return;
  obj.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

function getCanvasResolution(editor) {
  const dom = editor?.sceneManager?.renderer?.domElement;
  if (!dom) return new Vector2(1, 1);
  return new Vector2(dom.clientWidth, dom.clientHeight);
}

function makeLineMaterial({ color, linewidth, dashed, resolution }) {
  return new LineMaterial({
    color,
    linewidth,
    resolution,
    dashed: !!dashed,
    dashSize: 0.05,
    gapSize: 0.05,
    worldUnits: false,
    transparent: true,
    depthTest: false,
  });
}

function buildConnectedPolyline(points, mat) {
  if (!points?.length || points.length < 2) return null;
  const flat = [];
  for (const p of points) flat.push(p.x, p.y, p.z);
  const geom = new LineGeometry();
  geom.setPositions(flat);
  const line = new Line2(geom, mat);
  line.computeLineDistances();
  return line;
}

function buildSegments(segments, mat) {
  if (!segments?.length) return null;
  const flat = [];
  for (const seg of segments) {
    flat.push(seg.a.x, seg.a.y, seg.a.z, seg.b.x, seg.b.y, seg.b.z);
  }
  const geom = new LineSegmentsGeometry();
  geom.setPositions(flat);
  const line = new LineSegments2(geom, mat);
  line.computeLineDistances();
  return line;
}

// Renders the 3D drawing overlay:
//   - persistent trait3D wireframe + in-progress polyline + dashed preview
//     segment, all using Line2/LineSegments2 with screen-space pixel
//     thickness via LineMaterial
//   - a fixed-pixel-size SVG snap circle overlaid on the canvas (mirrors
//     the 2D SnappingLayer pattern)
export default function DrawingOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.drawingMode.active);
  const inProgressPolyline = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline
  );
  const trait3DSegments = useSelector(
    (s) => s.threedEditor.drawingMode.trait3DSegments
  );
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  const baseMaps = useBaseMaps()?.value;
  const mainBaseMapId = useMainBaseMap()?.id;

  const { findNearestSnap } = useVertexSnap({ active });

  const rootRef = useRef(null);
  const traitLinesRef = useRef(null);
  const inProgressLinesRef = useRef(null);
  const previewLineRef = useRef(null);
  const snapCircleRef = useRef(null);
  const crossARef = useRef(null);
  const crossBRef = useRef(null);
  const alignLineRef = useRef(null);

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
      previewLineRef.current = null;
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

  // sync in-progress polyline (committed segments only)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (inProgressLinesRef.current) {
      root.remove(inProgressLinesRef.current);
      disposeObject(inProgressLinesRef.current);
      inProgressLinesRef.current = null;
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
  // line (SVG, screen-space) + dashed preview segment or rectangle loop
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
    const anchorHost = anchor?.baseMapId
      ? (baseMaps || []).find((b) => b.id === anchor.baseMapId)
      : null;

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
    // MoveBaseMapOverlayThreed). The locked axis of a PLANE_ORTHO snap is
    // drawn solid in the lock color.
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
        const locked = snap.kind === "PLANE_ORTHO" && snap.axis === key;
        el.style.stroke = locked ? colorHex(COLOR_LOCK) : COLOR_CROSS;
        if (locked) el.removeAttribute("stroke-dasharray");
        else el.setAttribute("stroke-dasharray", "5 4");
        el.style.display = "block";
      });
    }

    function updateAlignLine(snap, rect) {
      const el = alignLineRef.current;
      if (!el) return;
      const from =
        snap?.kind === "PLANE_ALIGN" && snap.alignFrom
          ? toScreen(snap.alignFrom, rect)
          : null;
      const to = from ? toScreen(snap.position, rect) : null;
      if (!from || !to) {
        el.style.display = "none";
        return;
      }
      el.setAttribute("x1", from.sx);
      el.setAttribute("y1", from.sy);
      el.setAttribute("x2", to.sx);
      el.setAttribute("y2", to.sy);
      el.style.display = "block";
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
        color: colorForKind(snap.kind),
        linewidth: LINEWIDTH_PREVIEW,
        dashed: true,
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

    function updateRectanglePreview(snap) {
      const root = rootRef.current;
      if (!root) return;
      clearPreviewLine();
      if (!snap?.position || !anchor || !anchorHost) return;
      const corners = computeRectangleCorners(
        anchor,
        snap.position,
        anchorHost
      );
      if (!corners) return;
      const mat = makeLineMaterial({
        color: colorForKind(snap.kind),
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

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };
      const snap = computeSnapTarget({
        mouseNdc: ndc,
        camera,
        canvasSize,
        // While a rectangle anchor is set, the lastVertex-anchored modes
        // (AXIS / FREE / ortho) and the snap back onto the anchor itself are
        // meaningless — the second corner lives on the anchor's plan.
        lastVertex: anchor
          ? undefined
          : inProgressPolyline[inProgressPolyline.length - 1],
        inProgressPolyline: anchor ? [] : inProgressPolyline,
        findNearestVertex: (mNdc, cam, sz) => findNearestSnap(mNdc, cam, sz),
        findNearestEdge: (mNdc, cam, sz) =>
          findNearestEdgeSnap(getMeshAdjacency(), mNdc, cam, sz),
        intersectPlane: (mNdc) =>
          intersectBaseMapPlane(
            editor,
            mNdc,
            camera,
            // Stacked unplaced base maps are coplanar at the origin — prefer
            // the 2D-selected one so the drawing lands on the plan the user
            // is looking at (and will look for) in 2D.
            anchor
              ? { onlyBaseMapId: anchor.baseMapId }
              : { preferredBaseMapId: mainBaseMapId }
          ),
        alignAdjacency: getMeshAdjacency(),
      });
      setLastSnap(snap);
      updateSnapCircle(snap, rect);
      updateCross(snap, rect);
      updateAlignLine(snap, rect);
      if (anchor) updateRectanglePreview(snap);
      else updatePreviewLine(snap);
      editor.sceneManager.renderScene?.();
    }

    function onPointerLeave() {
      setLastSnap(null);
      if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
      if (crossARef.current) crossARef.current.style.display = "none";
      if (crossBRef.current) crossBRef.current.style.display = "none";
      if (alignLineRef.current) alignLineRef.current.style.display = "none";
      clearPreviewLine();
      editor.sceneManager.renderScene?.();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [
    active,
    findNearestSnap,
    inProgressPolyline,
    enabledDrawingMode,
    baseMaps,
    mainBaseMapId,
  ]);

  if (!active) return null;
  return (
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
      <line
        ref={alignLineRef}
        stroke={colorHex(COLOR_LOCK)}
        strokeWidth="1.5"
        strokeDasharray="5 4"
        style={{ display: "none" }}
      />
      <circle
        ref={snapCircleRef}
        r={SNAP_CIRCLE_RADIUS_PX}
        strokeWidth={SNAP_CIRCLE_STROKE_PX}
        fill="none"
        style={{ display: "none" }}
      />
    </svg>
  );
}
