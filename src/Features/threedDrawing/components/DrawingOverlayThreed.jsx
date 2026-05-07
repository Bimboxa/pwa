import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Group, Vector2 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import useVertexSnap from "../hooks/useVertexSnap";
import { setLastSnap } from "../services/lastSnapStore";
import computeSnapTarget from "../utils/computeSnapTarget";

const COLOR_VERTEX = 0xff2d8d;
const COLOR_AXIS_X = 0xff3b30;
const COLOR_AXIS_Y = 0x34c759;
const COLOR_AXIS_Z = 0x007aff;
const COLOR_FREE = 0x000000;
const COLOR_IN_PROGRESS = 0xff2d8d;
const COLOR_TRAIT = 0x8a8a8a;

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

  const { findNearestSnap } = useVertexSnap({ active });

  const rootRef = useRef(null);
  const traitLinesRef = useRef(null);
  const inProgressLinesRef = useRef(null);
  const previewLineRef = useRef(null);
  const snapCircleRef = useRef(null);

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

  // pointer-move: snap detection + hover marker (SVG, screen-space) +
  // dashed preview segment (Line2 with thick LineMaterial)
  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    const camera = editor?.sceneManager?.camera;
    if (!dom || !camera) return;

    const ndc = new Vector2();

    function updateSnapCircle(snap, rect) {
      const circle = snapCircleRef.current;
      if (!circle) return;
      if (!snap?.position) {
        circle.style.display = "none";
        return;
      }
      const projected = snap.position.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) {
        circle.style.display = "none";
        return;
      }
      const sx = ((projected.x + 1) / 2) * rect.width;
      const sy = ((1 - projected.y) / 2) * rect.height;
      circle.setAttribute("cx", sx);
      circle.setAttribute("cy", sy);
      circle.style.stroke = colorHex(colorForKind(snap.kind));
      circle.style.display = "block";
    }

    function updatePreviewLine(snap) {
      const root = rootRef.current;
      if (!root) return;
      if (previewLineRef.current) {
        root.remove(previewLineRef.current);
        disposeObject(previewLineRef.current);
        previewLineRef.current = null;
      }
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

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };
      const snap = computeSnapTarget({
        mouseNdc: ndc,
        camera,
        canvasSize,
        lastVertex: inProgressPolyline[inProgressPolyline.length - 1],
        inProgressPolyline,
        findNearestVertex: (mNdc, cam, sz) => findNearestSnap(mNdc, cam, sz),
      });
      setLastSnap(snap);
      updateSnapCircle(snap, rect);
      updatePreviewLine(snap);
      editor.sceneManager.renderScene?.();
    }

    function onPointerLeave() {
      setLastSnap(null);
      const circle = snapCircleRef.current;
      if (circle) circle.style.display = "none";
      if (previewLineRef.current) {
        rootRef.current?.remove(previewLineRef.current);
        disposeObject(previewLineRef.current);
        previewLineRef.current = null;
      }
      editor.sceneManager.renderScene?.();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [active, findNearestSnap, inProgressPolyline]);

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
