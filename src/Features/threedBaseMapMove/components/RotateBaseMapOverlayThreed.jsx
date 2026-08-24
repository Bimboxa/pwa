import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import useVertexSnap from "Features/threedDrawing/hooks/useVertexSnap";

import findNearestEdgeSnap from "Features/threedDimensions/utils/findNearestEdgeSnap";
import { getMeshAdjacency } from "Features/threedDrawing/services/meshGraphStore";
import findNearestVertexInVerts from "../utils/findNearestVertexInVerts";
import applyRotateBaseMapPose, {
  parseRotateAngleBuffer,
} from "../utils/applyRotateBaseMapPose";
import {
  setLastRotateSnap,
  getRotateGrab,
} from "../services/rotateBaseMapSessionStore";

const COLOR_VERTEX = "#ff2d8d";
const COLOR_EDGE = "#2e7d32";
const COLOR_FREE = "#000000";
const COLOR_PIVOT = "#e65100";
const COLOR_REF_LINE = "#9e9e9e";
const COLOR_CURRENT_LINE = "#e65100";

const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;
const PIVOT_CIRCLE_RADIUS_PX = 4;

// Cursor bearing around the world-vertical axis: rotating a direction by phi
// around +Y maps bearing -> bearing + phi with bearing = atan2(-dz, dx).
function bearingOf(dx, dz) {
  return Math.atan2(-dz, dx);
}

// A bearing difference lands in (-2π, 2π): bring the angle back to
// (-π, π] so the readout stays between -180° and +180°.
function normalizeAngle(phi) {
  let a = phi;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

// Live overlay of the "Tourner" (rotate base map) tool — CAD-style 3 clicks:
// 1. pivot phase: vertex snap marker for the pivot click;
// 2. reference phase: dashed helper line from the pivot to the cursor,
//    waiting for the click fixing the reference axis;
// 3. rotation phase: the base map group (image + annotations) rotates live
//    around the world-vertical axis through the pivot, by the angle between
//    the reference axis and the pivot→cursor direction; the fixed reference
//    ray stays displayed (grey) with the current ray (orange) and an angle
//    readout following the cursor.
// The target point snaps on the other objects (vertex / edge, target-only
// index) with a horizontal-plane free fallback. Mirrors
// MoveBaseMapOverlayThreed.
export default function RotateBaseMapOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.rotateBaseMapMode.active);

  const { findNearestSnap } = useVertexSnap({ active });

  const snapCircleRef = useRef(null);
  const pivotCircleRef = useRef(null);
  const refLineRef = useRef(null);
  const currentLineRef = useRef(null);
  const axisLineRef = useRef(null);
  const arcRef = useRef(null);
  const angleLabelRef = useRef(null);

  // pointer-move: snap detection + helper lines + live rotation
  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    const camera = editor?.sceneManager?.camera;
    if (!dom || !camera) return;

    const ndc = new Vector2();
    const raycaster = new Raycaster();
    const horizontalPlane = new Plane();
    const planeHit = new Vector3();
    const UP = new Vector3(0, 1, 0);

    function toScreen(worldPos, rect) {
      const projected = worldPos.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) return null;
      return {
        sx: ((projected.x + 1) / 2) * rect.width,
        sy: ((1 - projected.y) / 2) * rect.height,
      };
    }

    function updateCircle(circleRef, worldPos, rect, color) {
      const circle = circleRef.current;
      if (!circle) return null;
      const screen = worldPos ? toScreen(worldPos, rect) : null;
      if (!screen) {
        circle.style.display = "none";
        return null;
      }
      circle.setAttribute("cx", screen.sx);
      circle.setAttribute("cy", screen.sy);
      circle.style.stroke = color;
      circle.style.display = "block";
      return screen;
    }

    function updateLine(lineRef, fromScreen, toScreen_) {
      const line = lineRef.current;
      if (!line) return;
      if (!fromScreen || !toScreen_) {
        line.style.display = "none";
        return;
      }
      line.setAttribute("x1", fromScreen.sx);
      line.setAttribute("y1", fromScreen.sy);
      line.setAttribute("x2", toScreen_.sx);
      line.setAttribute("y2", toScreen_.sy);
      line.style.display = "block";
    }

    function updateAngleLabel(phi, screen) {
      const labelEl = angleLabelRef.current;
      if (!labelEl) return;
      if (phi == null || !screen) {
        labelEl.style.display = "none";
        return;
      }
      labelEl.textContent = `${((phi * 180) / Math.PI).toFixed(1)}°`;
      labelEl.setAttribute("x", screen.sx + 12);
      labelEl.setAttribute("y", screen.sy - 12);
      labelEl.style.display = "block";
    }

    function hideAll() {
      [
        snapCircleRef,
        pivotCircleRef,
        refLineRef,
        currentLineRef,
        axisLineRef,
        arcRef,
      ].forEach((r) => {
        if (r.current) r.current.style.display = "none";
      });
      updateAngleLabel(null, null);
    }

    // World point at `bearing` and `radius` from the pivot, in the
    // horizontal plane (bearing = atan2(-dz, dx) convention).
    function pointAtBearing(pivot, bearing, radius) {
      return new Vector3(
        pivot.x + radius * Math.cos(bearing),
        pivot.y,
        pivot.z - radius * Math.sin(bearing)
      );
    }

    // Small vertical dashed line through the pivot = the rotation axis.
    function updateAxisLine(grab, rect, radius) {
      const h = Math.min(Math.max(radius * 0.6, 0.3), 4);
      const top = toScreen(
        new Vector3(grab.pivot.x, grab.pivot.y + h, grab.pivot.z),
        rect
      );
      const bottom = toScreen(
        new Vector3(grab.pivot.x, grab.pivot.y - h * 0.25, grab.pivot.z),
        rect
      );
      updateLine(axisLineRef, bottom, top);
    }

    // Protractor sector between the reference ray and the current angle.
    function updateArc(grab, rect, radius, phi) {
      const arc = arcRef.current;
      if (!arc) return;
      const pivotScreen = toScreen(grab.pivot, rect);
      if (!pivotScreen || phi == null || Math.abs(phi) < 1e-4) {
        arc.style.display = "none";
        return;
      }
      const r = radius * 0.55;
      const steps = Math.max(
        2,
        Math.ceil(Math.abs(phi) / ((5 * Math.PI) / 180))
      );
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const beta = grab.refBearing + (phi * i) / steps;
        const screen = toScreen(pointAtBearing(grab.pivot, beta, r), rect);
        if (!screen) {
          arc.style.display = "none";
          return;
        }
        pts.push(screen);
      }
      const d =
        `M ${pivotScreen.sx} ${pivotScreen.sy} ` +
        pts.map((p) => `L ${p.sx} ${p.sy}`).join(" ") +
        " Z";
      arc.setAttribute("d", d);
      arc.style.display = "block";
    }

    // Target point driving the reference / rotation phases. The reference
    // phase snaps on EVERYTHING (global index — the reference axis usually
    // anchors on a point of the base map being rotated, which hasn't moved
    // yet); the rotation phase snaps on the target-only index (the carried
    // geometry moves, its index entries are stale, and it would screen the
    // targets). Fallback: the horizontal plane through the pivot.
    function computeTarget(grab, canvasSize) {
      const rotating = grab.refBearing != null;
      let target;
      if (rotating) {
        target =
          findNearestVertexInVerts(
            grab.targetVerts,
            ndc,
            camera,
            canvasSize,
            12
          ) ??
          findNearestEdgeSnap(
            grab.targetAdjacency,
            ndc,
            camera,
            canvasSize,
            12
          );
      } else {
        const vertexSnap = findNearestSnap(ndc, camera, canvasSize, 12);
        target = vertexSnap
          ? { position: vertexSnap.position, kind: "VERTEX" }
          : findNearestEdgeSnap(
              getMeshAdjacency(),
              ndc,
              camera,
              canvasSize,
              12
            );
      }
      if (!target) {
        raycaster.setFromCamera(ndc, camera);
        horizontalPlane.setFromNormalAndCoplanarPoint(UP, grab.pivot);
        if (raycaster.ray.intersectPlane(horizontalPlane, planeHit)) {
          target = { position: planeHit.clone(), kind: "FREE" };
        }
      }
      return target;
    }

    function colorForKind(kind) {
      return kind === "VERTEX"
        ? COLOR_VERTEX
        : kind === "EDGE"
          ? COLOR_EDGE
          : COLOR_FREE;
    }

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };

      const grab = getRotateGrab();

      // Phase 1 — pivot pick: vertex snap on every snappable object.
      if (!grab) {
        const vertexSnap = findNearestSnap(ndc, camera, canvasSize, 12);
        const snap = vertexSnap
          ? {
              position: vertexSnap.position,
              kind: "VERTEX",
              meshKey: vertexSnap.meshKey,
            }
          : null;
        setLastRotateSnap(snap);
        hideAll();
        updateCircle(snapCircleRef, snap?.position ?? null, rect, COLOR_VERTEX);
        editor.renderScene?.();
        return;
      }

      const pivotScreen = updateCircle(
        pivotCircleRef,
        grab.pivot,
        rect,
        COLOR_PIVOT
      );

      const target = computeTarget(grab, canvasSize);
      setLastRotateSnap(target);
      const targetScreen = target
        ? updateCircle(
            snapCircleRef,
            target.position,
            rect,
            colorForKind(target.kind)
          )
        : null;

      // Phase 2 — reference axis pick: dashed helper from the pivot to the
      // cursor, no rotation yet.
      if (grab.refBearing == null) {
        const refRadius = target
          ? Math.hypot(
              target.position.x - grab.pivot.x,
              target.position.z - grab.pivot.z
            )
          : 1;
        updateAxisLine(grab, rect, Math.max(refRadius, 0.5));
        updateLine(refLineRef, pivotScreen, targetScreen);
        if (currentLineRef.current)
          currentLineRef.current.style.display = "none";
        if (arcRef.current) arcRef.current.style.display = "none";
        updateAngleLabel(null, null);
        editor.renderScene?.();
        return;
      }

      // Phase 3 — rotation: the angle opens between the fixed reference ray
      // and the pivot→cursor ray. A parsable typed buffer (degrees) wins
      // over the mouse.
      const refRadius = grab.refPoint
        ? Math.max(
            Math.hypot(
              grab.refPoint.x - grab.pivot.x,
              grab.refPoint.z - grab.pivot.z
            ),
            0.2
          )
        : 1;
      const refScreen = grab.refPoint ? toScreen(grab.refPoint, rect) : null;
      updateAxisLine(grab, rect, refRadius);
      updateLine(refLineRef, pivotScreen, refScreen);

      const typedPhi = parseRotateAngleBuffer(grab.angleBuffer);
      if (typedPhi != null) {
        applyRotateBaseMapPose(editor, grab, typedPhi);
        const endScreen = toScreen(
          pointAtBearing(grab.pivot, grab.refBearing + typedPhi, refRadius),
          rect
        );
        updateLine(currentLineRef, pivotScreen, endScreen);
        if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
        updateArc(grab, rect, refRadius, typedPhi);
        updateAngleLabel(typedPhi, endScreen);
        editor.renderScene?.();
        return;
      }

      if (target) {
        const dx = target.position.x - grab.pivot.x;
        const dz = target.position.z - grab.pivot.z;
        // Degenerate cursor on the pivot: keep the current angle.
        if (Math.hypot(dx, dz) > 1e-6) {
          applyRotateBaseMapPose(
            editor,
            grab,
            normalizeAngle(bearingOf(dx, dz) - grab.refBearing)
          );
        }
      }

      updateLine(currentLineRef, pivotScreen, targetScreen);
      updateArc(grab, rect, refRadius, grab.currentPhi);
      updateAngleLabel(grab.currentPhi, targetScreen);
      editor.renderScene?.();
    }

    function onPointerLeave() {
      setLastRotateSnap(null);
      hideAll();
      editor.renderScene?.();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      setLastRotateSnap(null);
    };
  }, [active, findNearestSnap]);

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
      <path
        ref={arcRef}
        fill="rgba(230, 81, 0, 0.15)"
        stroke={COLOR_CURRENT_LINE}
        strokeWidth="1"
        style={{ display: "none" }}
      />
      <line
        ref={axisLineRef}
        stroke={COLOR_PIVOT}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        style={{ display: "none" }}
      />
      <line
        ref={refLineRef}
        stroke={COLOR_REF_LINE}
        strokeWidth="2"
        strokeDasharray="6 4"
        style={{ display: "none" }}
      />
      <line
        ref={currentLineRef}
        stroke={COLOR_CURRENT_LINE}
        strokeWidth="2"
        strokeDasharray="6 4"
        style={{ display: "none" }}
      />
      <circle
        ref={pivotCircleRef}
        r={PIVOT_CIRCLE_RADIUS_PX}
        strokeWidth={SNAP_CIRCLE_STROKE_PX}
        fill={COLOR_PIVOT}
        style={{ display: "none" }}
      />
      <circle
        ref={snapCircleRef}
        r={SNAP_CIRCLE_RADIUS_PX}
        strokeWidth={SNAP_CIRCLE_STROKE_PX}
        fill="none"
        style={{ display: "none" }}
      />
      <text
        ref={angleLabelRef}
        fontSize="13"
        fontWeight="600"
        fill="#bf360c"
        stroke="#ffffff"
        strokeWidth="3"
        paintOrder="stroke"
        style={{ display: "none" }}
      />
    </svg>
  );
}
