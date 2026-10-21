import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";
import useVertexSnap from "Features/threedDrawing/hooks/useVertexSnap";
import intersectBaseMapPlane from "Features/threedBaseMapMove/utils/intersectBaseMapPlane";

import computeAxesYawFromPoints from "../utils/computeAxesYawFromPoints";
import {
  setLastAxesPlacementSnap,
  getAxesPlacementGrab,
} from "../services/axesPlacementSessionStore";

const COLOR_VERTEX = "#ff2d8d";
const COLOR_PLANE = "#1565c0";
const COLOR_CROSS = "#90a4ae";
const COLOR_FREE = "#000000";
const COLOR_ORIGIN = "#212121";
const COLOR_X_AXIS = AXIS_COLORS.X;

const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;
const ORIGIN_CIRCLE_RADIUS_PX = 4;

// Live overlay of the « Orienter le repère » tool — 2 clicks:
// 1. origin phase: snap marker under the cursor (vertex snap on every
//    snappable object, else a direct hit on a base map image plane with the
//    cross helper, else a free point on the horizontal plane of the current
//    frame origin);
// 2. direction phase: the direction point lives IN THE HORIZONTAL PLANE OF
//    THE ORIGIN — the free hit is the ray ∩ that plane (so the X axis passes
//    under the cursor on screen, whatever the camera), a vertex snap at
//    another height is projected on it (dotted vertical drop line between
//    the two, the snap circle on the real vertex); no base map plane hit
//    here, a plan at another height would pull the point off the plane.
//    Dashed red (X colour) helper from the origin to the direction point,
//    the in-scene axes helper rotates live around its vertical axis so its
//    X axis runs along it, with a yaw readout.
// Helpers are screen-space SVG, like RotateBaseMapOverlayThreed. The click
// handling lives in useAxesPlacementPointerHandlers (reads the snap
// published here through the session store).
export default function AxesPlacementOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.axesPlacementMode.active);
  // Yaw of the committed frame: the cross arms of a plane hit follow it.
  const yawDeg = useSelector((s) => s.threedEditor.axesSettings.yawDeg);
  const yawDegRef = useRef(yawDeg);
  yawDegRef.current = yawDeg;

  const { findNearestSnap } = useVertexSnap({ active });

  const snapCircleRef = useRef(null);
  const originCircleRef = useRef(null);
  const directionLineRef = useRef(null);
  const dropLineRef = useRef(null);
  const crossARef = useRef(null);
  const crossBRef = useRef(null);
  const yawLabelRef = useRef(null);

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

    function updateYawLabel(yaw, screen) {
      const labelEl = yawLabelRef.current;
      if (!labelEl) return;
      if (yaw == null || !screen) {
        labelEl.style.display = "none";
        return;
      }
      labelEl.textContent = `X ${yaw.toFixed(1)}°`;
      labelEl.setAttribute("x", screen.sx + 12);
      labelEl.setAttribute("y", screen.sy - 12);
      labelEl.style.display = "block";
    }

    function hideAll() {
      [
        snapCircleRef,
        originCircleRef,
        directionLineRef,
        dropLineRef,
        crossARef,
        crossBRef,
      ].forEach((r) => {
        if (r.current) r.current.style.display = "none";
      });
      updateYawLabel(null, null);
    }

    function colorForKind(kind) {
      return kind === "VERTEX"
        ? COLOR_VERTEX
        : kind === "PLANE"
          ? COLOR_PLANE
          : COLOR_FREE;
    }

    // Cross helper of a PLANE hit: the two dashed lines through the point,
    // along the user axes lying in the plane, ending on its borders.
    function updateCross(target, rect) {
      const show = target?.kind === "PLANE" && target.axisA && target.axisB;
      [
        [crossARef, target?.axisA],
        [crossBRef, target?.axisB],
      ].forEach(([ref, axis]) => {
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
        el.style.display = "block";
      });
    }

    // Point under the cursor: vertex snap → base map image plane (cross,
    // origin phase only) → free point on the horizontal plane through
    // `anchor`.
    function computeTarget(canvasSize, anchor, { withPlaneHit }) {
      const vertexSnap = findNearestSnap(ndc, camera, canvasSize, 12);
      if (vertexSnap) {
        return {
          position: vertexSnap.position,
          kind: "VERTEX",
          meshKey: vertexSnap.meshKey,
        };
      }
      const planeHitTarget = withPlaneHit
        ? intersectBaseMapPlane(editor, ndc, camera, {
            axes: getUserAxesWorldDirections(yawDegRef.current),
          })
        : null;
      if (planeHitTarget) {
        return {
          position: planeHitTarget.position,
          kind: "PLANE",
          baseMapId: planeHitTarget.baseMapId,
          axisA: planeHitTarget.axisA,
          axisB: planeHitTarget.axisB,
        };
      }
      raycaster.setFromCamera(ndc, camera);
      horizontalPlane.setFromNormalAndCoplanarPoint(UP, anchor);
      if (raycaster.ray.intersectPlane(horizontalPlane, planeHit)) {
        return { position: planeHit.clone(), kind: "FREE" };
      }
      return null;
    }

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };

      const axes = editor?.sceneManager?.axes;
      const grab = getAxesPlacementGrab();

      // Phase 1 — origin pick.
      if (!grab) {
        const anchor = axes?.position ?? new Vector3();
        const snap = computeTarget(canvasSize, anchor, { withPlaneHit: true });
        setLastAxesPlacementSnap(snap);
        hideAll();
        updateCircle(
          snapCircleRef,
          snap?.position ?? null,
          rect,
          colorForKind(snap?.kind)
        );
        updateCross(snap, rect);
        return;
      }

      // Phase 2 — X axis direction: the helper turns towards the cursor.
      const originScreen = updateCircle(
        originCircleRef,
        grab.origin,
        rect,
        COLOR_ORIGIN
      );
      const target = computeTarget(canvasSize, grab.origin, {
        withPlaneHit: false,
      });
      setLastAxesPlacementSnap(target);
      const targetScreen = target
        ? updateCircle(
            snapCircleRef,
            target.position,
            rect,
            colorForKind(target.kind)
          )
        : null;
      updateCross(null, rect);

      // Direction point = the target projected in the origin's horizontal
      // plane: the dashed helper then runs along the X axis on screen. A
      // vertex at another height shows its drop line.
      const directionPoint = target
        ? new Vector3(target.position.x, grab.origin.y, target.position.z)
        : null;
      const offPlane =
        !!target && Math.abs(target.position.y - grab.origin.y) > 1e-3;
      const directionScreen = directionPoint
        ? toScreen(directionPoint, rect)
        : null;
      updateLine(directionLineRef, originScreen, directionScreen);
      updateLine(
        dropLineRef,
        offPlane ? directionScreen : null,
        offPlane ? targetScreen : null
      );

      const yaw = target
        ? computeAxesYawFromPoints(grab.origin, target.position)
        : null;
      // Degenerate cursor on the origin: keep the current rotation.
      if (yaw != null && axes) {
        axes.rotation.y = (yaw * Math.PI) / 180;
        editor.renderScene?.();
      }
      updateYawLabel(yaw, targetScreen);
    }

    function onPointerLeave() {
      setLastAxesPlacementSnap(null);
      hideAll();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      setLastAxesPlacementSnap(null);
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
        ref={dropLineRef}
        stroke={COLOR_CROSS}
        strokeWidth="1.5"
        strokeDasharray="2 3"
        style={{ display: "none" }}
      />
      <line
        ref={directionLineRef}
        stroke={COLOR_X_AXIS}
        strokeWidth="2"
        strokeDasharray="6 4"
        style={{ display: "none" }}
      />
      <circle
        ref={originCircleRef}
        r={ORIGIN_CIRCLE_RADIUS_PX}
        strokeWidth={SNAP_CIRCLE_STROKE_PX}
        fill={COLOR_ORIGIN}
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
        ref={yawLabelRef}
        fontSize="13"
        fontWeight="600"
        fill={COLOR_X_AXIS}
        stroke="#ffffff"
        strokeWidth="3"
        paintOrder="stroke"
        style={{ display: "none" }}
      />
    </svg>
  );
}
