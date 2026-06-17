import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Group, Vector2, Vector3 } from "three";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import useVertexSnap from "Features/threedDrawing/hooks/useVertexSnap";

import { setLastDimensionSnap } from "../services/lastDimensionSnapStore";
import computeDimensionSnap from "../utils/computeDimensionSnap";
import formatCoteLength from "../utils/formatCoteLength";

const COLOR_VERTEX = "#1565c0";
const COLOR_EDGE = "#2e7d32";
const COLOR_PREVIEW = 0x1565c0;
const LINEWIDTH_PREVIEW = 3;

const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;

function colorForKind(kind) {
  return kind === "EDGE" ? COLOR_EDGE : COLOR_VERTEX;
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

// Live overlay for the dimension ("cote") tool: a fixed-pixel-size SVG snap
// circle on the canvas, a dashed preview segment from the placed start point to
// the current snap, and a live length readout. Mirrors DrawingOverlayThreed.
export default function DimensionDraftOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.dimensionMode.active);
  const startPoint = useSelector(
    (s) => s.threedEditor.dimensionMode.startPoint
  );

  const { findNearestSnap } = useVertexSnap({ active });

  const rootRef = useRef(null);
  const previewLineRef = useRef(null);
  const snapCircleRef = useRef(null);
  const lengthLabelRef = useRef(null);

  // mount / unmount root group
  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const scene = editor?.sceneManager?.scene;
    if (!scene) return;

    const root = new Group();
    root.name = "DimensionDraftOverlayThreed";
    scene.add(root);
    rootRef.current = root;
    editor.sceneManager.renderScene?.();

    return () => {
      scene.remove(root);
      disposeObject(root);
      rootRef.current = null;
      previewLineRef.current = null;
      editor.sceneManager.renderScene?.();
    };
  }, [active]);

  // pointer-move: snap detection + hover marker + preview segment + readout
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
      circle.style.stroke = colorForKind(snap.kind);
      circle.style.display = "block";
      return { sx, sy };
    }

    function updateLengthLabel(snap, screen) {
      const labelEl = lengthLabelRef.current;
      if (!labelEl) return;
      if (!snap?.position || !startPoint || !screen) {
        labelEl.style.display = "none";
        return;
      }
      const a = new Vector3(startPoint.x, startPoint.y, startPoint.z);
      const dist = a.distanceTo(snap.position);
      labelEl.textContent = formatCoteLength({ meters: dist });
      labelEl.setAttribute("x", screen.sx + 12);
      labelEl.setAttribute("y", screen.sy - 12);
      labelEl.style.display = "block";
    }

    function updatePreviewLine(snap) {
      const root = rootRef.current;
      if (!root) return;
      if (previewLineRef.current) {
        root.remove(previewLineRef.current);
        disposeObject(previewLineRef.current);
        previewLineRef.current = null;
      }
      const snapPos = snap?.position;
      if (!snapPos || !startPoint) return;

      const mat = new LineMaterial({
        color: COLOR_PREVIEW,
        linewidth: LINEWIDTH_PREVIEW,
        resolution: getCanvasResolution(editor),
        dashed: true,
        dashSize: 0.05,
        gapSize: 0.05,
        worldUnits: false,
        transparent: true,
        depthTest: false,
      });
      const geom = new LineSegmentsGeometry();
      geom.setPositions([
        startPoint.x,
        startPoint.y,
        startPoint.z,
        snapPos.x,
        snapPos.y,
        snapPos.z,
      ]);
      const line = new LineSegments2(geom, mat);
      line.computeLineDistances();
      line.renderOrder = 1002;
      root.add(line);
      previewLineRef.current = line;
    }

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };
      const snap = computeDimensionSnap({
        mouseNdc: ndc,
        camera,
        canvasSize,
        findNearestVertex: (mNdc, cam, sz) => findNearestSnap(mNdc, cam, sz),
      });
      setLastDimensionSnap(snap);
      const screen = updateSnapCircle(snap, rect);
      updateLengthLabel(snap, screen);
      updatePreviewLine(snap);
      editor.sceneManager.renderScene?.();
    }

    function onPointerLeave() {
      setLastDimensionSnap(null);
      if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
      if (lengthLabelRef.current) lengthLabelRef.current.style.display = "none";
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
  }, [active, findNearestSnap, startPoint]);

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
      <text
        ref={lengthLabelRef}
        fontSize="13"
        fontWeight="600"
        fill="#0d47a1"
        stroke="#ffffff"
        strokeWidth="3"
        paintOrder="stroke"
        style={{ display: "none" }}
      />
    </svg>
  );
}
