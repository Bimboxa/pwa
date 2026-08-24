import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import useVertexSnap from "Features/threedDrawing/hooks/useVertexSnap";

import findNearestEdgeSnap from "Features/threedDimensions/utils/findNearestEdgeSnap";
import findNearestVertexInVerts from "../utils/findNearestVertexInVerts";
import {
  setLastRotateSnap,
  getRotateGrab,
} from "../services/rotateBaseMapSessionStore";

const COLOR_VERTEX = "#ff2d8d";
const COLOR_EDGE = "#2e7d32";
const COLOR_FREE = "#000000";
const COLOR_PIVOT = "#e65100";

const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;
const PIVOT_CIRCLE_RADIUS_PX = 4;
// Cursor closer to the pivot than this (screen px) does not drive the angle
// (the bearing would be numerically unstable).
const MIN_BEARING_DIST_PX = 15;

// Cursor bearing around the world-vertical axis: rotating a direction by phi
// around +Y maps bearing -> bearing + phi with bearing = atan2(-dz, dx).
function bearingOf(dx, dz) {
  return Math.atan2(-dz, dx);
}

// Live overlay of the "Tourner" (rotate base map) tool: vertex snap marker
// for the pivot click, then — while rotating — the live rotation of the base
// map group (image + annotations) around the world-vertical axis through the
// pivot, driven by the cursor bearing; the target point snaps on the other
// objects (vertex / edge, target-only index) with a horizontal-plane free
// fallback. An SVG angle readout follows the cursor. Mirrors
// MoveBaseMapOverlayThreed.
export default function RotateBaseMapOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.rotateBaseMapMode.active);

  const { findNearestSnap } = useVertexSnap({ active });

  const snapCircleRef = useRef(null);
  const pivotCircleRef = useRef(null);
  const angleLabelRef = useRef(null);

  // pointer-move: snap detection + live rotation + markers
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

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };

      const grab = getRotateGrab();

      if (!grab) {
        // Pivot phase: vertex snap on every snappable object.
        const vertexSnap = findNearestSnap(ndc, camera, canvasSize, 12);
        const snap = vertexSnap
          ? {
              position: vertexSnap.position,
              kind: "VERTEX",
              meshKey: vertexSnap.meshKey,
            }
          : null;
        setLastRotateSnap(snap);
        updateCircle(snapCircleRef, snap?.position ?? null, rect, COLOR_VERTEX);
        if (pivotCircleRef.current)
          pivotCircleRef.current.style.display = "none";
        updateAngleLabel(null, null);
        editor.renderScene?.();
        return;
      }

      // Rotation phase — pivot marker.
      updateCircle(pivotCircleRef, grab.pivot, rect, COLOR_PIVOT);

      // Target point driving the bearing: snapped vertex / edge on the
      // target-only index, else the horizontal plane through the pivot.
      let target =
        findNearestVertexInVerts(
          grab.targetVerts,
          ndc,
          camera,
          canvasSize,
          12
        ) ??
        findNearestEdgeSnap(grab.targetAdjacency, ndc, camera, canvasSize, 12);
      if (!target) {
        raycaster.setFromCamera(ndc, camera);
        horizontalPlane.setFromNormalAndCoplanarPoint(UP, grab.pivot);
        if (raycaster.ray.intersectPlane(horizontalPlane, planeHit)) {
          target = { position: planeHit.clone(), kind: "FREE" };
        }
      }

      const targetScreen = target
        ? updateCircle(
            snapCircleRef,
            target.position,
            rect,
            target.kind === "VERTEX"
              ? COLOR_VERTEX
              : target.kind === "EDGE"
                ? COLOR_EDGE
                : COLOR_FREE
          )
        : null;

      // Bearing → live rotation. Ignore cursors too close to the pivot
      // (unstable bearing): the current angle is kept.
      if (target) {
        const pivotScreen = toScreen(grab.pivot, rect);
        const farEnough =
          !pivotScreen ||
          Math.hypot(
            (targetScreen?.sx ?? 0) - pivotScreen.sx,
            (targetScreen?.sy ?? 0) - pivotScreen.sy
          ) > MIN_BEARING_DIST_PX;
        if (farEnough) {
          const dx = target.position.x - grab.pivot.x;
          const dz = target.position.z - grab.pivot.z;
          const bearing = bearingOf(dx, dz);
          if (grab.refBearing == null) grab.refBearing = bearing;
          const phi = bearing - grab.refBearing;
          grab.currentPhi = phi;

          const group = editor?.sceneManager?.imagesManager?.getGroup(
            grab.baseMapId
          );
          if (group) {
            // World-Y rotation: with the group's YXZ euler, adding to
            // rotation.y IS a rotation around the world-vertical axis —
            // whatever the plane orientation.
            group.rotation.y = grab.groupStartRotY + phi;
            // Position orbits the pivot in the horizontal plane.
            const px = grab.groupStartPosition.x - grab.pivot.x;
            const pz = grab.groupStartPosition.z - grab.pivot.z;
            const cos = Math.cos(phi);
            const sin = Math.sin(phi);
            group.position.set(
              grab.pivot.x + px * cos + pz * sin,
              grab.groupStartPosition.y,
              grab.pivot.z - px * sin + pz * cos
            );
          }
        }
      }

      updateAngleLabel(grab.currentPhi, targetScreen);
      editor.renderScene?.();
    }

    function onPointerLeave() {
      setLastRotateSnap(null);
      if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
      if (angleLabelRef.current) angleLabelRef.current.style.display = "none";
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
