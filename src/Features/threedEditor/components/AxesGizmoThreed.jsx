import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { Quaternion, Vector3 } from "three";

import { Box } from "@mui/material";

import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";

// Orientation gizmo of the 3D view (top-right corner, 3D view settings
// "Gizmo d'orientation"): the displayed X / Y / Z axes projected with the
// camera orientation, Blender-style. Clicking an axis end places the camera
// on that side of the orbit target, looking along the axis; clicking the end
// the camera already faces shows the opposite face.
//
// Around the axes, an orbit ring with a draggable knob: dragging the knob
// along the ring turns the camera around the user's vertical axis while the
// orbit target, the tilt and the distance stay as they are (turntable
// rotation, for users who struggle with the free click-drag orbit). The
// engine world is Y up (user Z = world Y), so "around the vertical" is a
// change of the camera-controls azimuth alone. The knob marks where the
// camera stands seen from above, in the gizmo's own top view (user X to the
// right, user Y down, frame yaw included), so it agrees with the axes.
//
// Pure DOM/SVG overlay: it never touches the renderer. It follows the camera
// through SceneManager.addRenderListener (fired after every renderScene) and
// drives the camera through ControlsManager.animateToTopDown (axis clicks)
// and cameraControls.rotateAzimuthTo (ring drag). The displayed frame yaw
// (axesSettings) rotates the axes only — purely visual.

const SIZE = 112;
const CENTER = SIZE / 2;
const RADIUS = 34; // distance of the axis ends from the centre (px)
const END_RADIUS = 9; // positive end circle (px)
const NEG_END_RADIUS = 6; // negative end circle (px)
const RING_RADIUS = 50; // orbit ring (px)
const RING_HIT_WIDTH = 14; // invisible grab band along the ring (px)
const KNOB_RADIUS = 6; // orbit knob (px)
const QUAT_EPSILON = 1e-4;
const AZIMUTH_EPSILON = 1e-4;
// Smooth time while the knob is dragged: same reactivity as the controls'
// own drag (ControlsManager draggingSmoothTime).
const DRAG_SMOOTH_TIME = 0.05;
// Where the knob sits on the ring: +1 = the side the camera stands on (seen
// from above), -1 = the side the camera looks toward. The drag direction
// follows the knob by construction whichever side is chosen.
const KNOB_SIDE = 1;

// Camera-local projection of the 6 axis ends (world dir → view space with the
// inverse camera quaternion): screen x = v.x, screen y = -v.y, depth = v.z
// (positive = toward the viewer, drawn last).
function projectAxisEnds(cameraQuaternion, yawDeg, scratch) {
  const inv = scratch.inv.copy(cameraQuaternion).invert();
  const ends = [];
  getUserAxesWorldDirections(yawDeg).forEach(({ key, color, dir }) => {
    [1, -1].forEach((sign) => {
      const v = scratch.v.copy(dir).multiplyScalar(sign).applyQuaternion(inv);
      ends.push({
        id: `${sign > 0 ? "+" : "-"}${key}`,
        key,
        color,
        sign,
        x: CENTER + v.x * RADIUS,
        y: CENTER - v.y * RADIUS,
        depth: v.z,
      });
    });
  });
  // Far ends first so the near ones paint on top.
  ends.sort((a, b) => a.depth - b.depth);
  return ends;
}

// Top-view projection of the camera side onto the ring. The camera-controls
// azimuth is measured around world Y, from +Z toward +X: the horizontal
// camera direction is (sin az, 0, cos az). It is projected onto the user X
// and Y world directions (frame yaw included) with X to the right and Y down,
// the same top view the axis ends show when looking from above. Reading the
// azimuth rather than the camera position keeps the knob defined at the
// poles (top-down view), where the horizontal offset vanishes.
function projectKnob(azimuthRad, yawDeg, scratch) {
  const axes = getUserAxesWorldDirections(yawDeg);
  const axisX = axes.find((a) => a.key === "X");
  const axisY = axes.find((a) => a.key === "Y");
  const axisZ = axes.find((a) => a.key === "Z");
  const dir = scratch.v.set(Math.sin(azimuthRad), 0, Math.cos(azimuthRad));
  const x = KNOB_SIDE * dir.dot(axisX.dir);
  const y = KNOB_SIDE * dir.dot(axisY.dir);
  const len = Math.hypot(x, y) || 1;
  return {
    cx: CENTER + (x / len) * RING_RADIUS,
    cy: CENTER + (y / len) * RING_RADIUS,
    color: axisZ?.color ?? "#3b82f6",
  };
}

// Wrap an angle difference into (-PI, PI].
function wrapAngle(d) {
  return (
    ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
  );
}

export default function AxesGizmoThreed({ threedEditorRef, sx }) {
  // strings

  const viewAlongS = (id) => `Vue selon ${id}`;
  const orbitRingS = "Tourner la vue autour de la verticale";

  // data

  const yawDeg = useSelector((s) => s.threedEditor.axesSettings.yawDeg);

  // state

  const [ends, setEnds] = useState([]);
  const [knob, setKnob] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  // helpers

  const svgRef = useRef(null);
  // Active ring drag: pointer id, last pointer angle, azimuth being driven,
  // smooth time to restore.
  const dragRef = useRef(null);

  const scratchRef = useRef({
    inv: new Quaternion(),
    v: new Vector3(),
    lastQuat: new Quaternion(0, 0, 0, 0),
    lastYaw: null,
    lastAzimuth: null,
  });

  const getControls = useCallback(
    () =>
      threedEditorRef.current?.sceneManager?.controlsManager?.cameraControls,
    [threedEditorRef]
  );

  const refresh = useCallback(
    (force) => {
      const camera = threedEditorRef.current?.sceneManager?.camera;
      if (!camera) return;
      const scratch = scratchRef.current;
      const q = camera.quaternion;
      const azimuth = getControls()?.azimuthAngle ?? 0;
      const same =
        !force &&
        scratch.lastYaw === yawDeg &&
        Math.abs(scratch.lastQuat.x - q.x) < QUAT_EPSILON &&
        Math.abs(scratch.lastQuat.y - q.y) < QUAT_EPSILON &&
        Math.abs(scratch.lastQuat.z - q.z) < QUAT_EPSILON &&
        Math.abs(scratch.lastQuat.w - q.w) < QUAT_EPSILON &&
        scratch.lastAzimuth !== null &&
        Math.abs(scratch.lastAzimuth - azimuth) < AZIMUTH_EPSILON;
      if (same) return;
      scratch.lastQuat.copy(q);
      scratch.lastYaw = yawDeg;
      scratch.lastAzimuth = azimuth;
      setEnds(projectAxisEnds(q, yawDeg, scratch));
      setKnob(projectKnob(azimuth, yawDeg, scratch));
    },
    [threedEditorRef, getControls, yawDeg]
  );

  // Follow the camera: one listener per mount, re-projected on yaw change.
  useEffect(() => {
    const sceneManager = threedEditorRef.current?.sceneManager;
    if (!sceneManager?.addRenderListener) return undefined;
    const listener = () => refresh(false);
    sceneManager.addRenderListener(listener);
    refresh(true);
    return () => sceneManager.removeRenderListener(listener);
  }, [threedEditorRef, refresh]);

  // Pointer angle around the gizmo centre, in SVG screen orientation
  // (x right, y down), i.e. the same orientation as the knob position.
  function pointerAngle(event) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const scale = rect.width ? SIZE / rect.width : 1;
    const px = (event.clientX - rect.left) * scale - CENTER;
    const py = (event.clientY - rect.top) * scale - CENTER;
    return Math.atan2(py, px);
  }

  // The knob screen angle is PI/2 - azimuth (+ a yaw / side offset), so a
  // knob rotation d on screen is an azimuth change of -d.
  const knobDeltaToAzimuth = (d) => -d;

  // handlers

  function handleEndClick(end) {
    const sceneManager = threedEditorRef.current?.sceneManager;
    const controlsManager = sceneManager?.controlsManager;
    const controls = controlsManager?.cameraControls;
    if (!controls) return;

    const axis = getUserAxesWorldDirections(yawDeg).find(
      (a) => a.key === end.key
    );
    if (!axis) return;
    const dir = axis.dir.clone().multiplyScalar(end.sign);

    const target = controls.getTarget(new Vector3());
    const current = controls.getPosition(new Vector3()).sub(target);
    if (current.lengthSq() > 0) {
      current.normalize();
      // Already looking along this axis: show the opposite face.
      if (current.dot(dir) > 0.999) dir.negate();
    }

    // Same spherical convention as ControlsManager.fitToBox3Facing (Y up),
    // polar kept off the exact poles (camera-controls degeneracy).
    const azimuthRad = Math.atan2(dir.x, dir.z);
    const polarRad = Math.min(
      Math.PI - 0.001,
      Math.max(0.001, Math.acos(Math.min(1, Math.max(-1, dir.y))))
    );
    controlsManager.animateToTopDown({ target, azimuthRad, polarRad });
  }

  // Start a ring drag from the knob or from anywhere on the ring. From the
  // ring, the knob first jumps to the pressed angle; the drag then goes on
  // from there. The pointer is captured so the canvas underneath never sees
  // the gesture (no competing orbit, no pivot change).
  function handleRingPointerDown(event, fromRing) {
    const controls = getControls();
    if (!controls || dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const phi = pointerAngle(event);
    let azimuth = controls.azimuthAngle;
    if (fromRing && knob) {
      const knobPhi = Math.atan2(knob.cy - CENTER, knob.cx - CENTER);
      azimuth += knobDeltaToAzimuth(wrapAngle(phi - knobPhi));
    }
    dragRef.current = {
      pointerId: event.pointerId,
      phiPrev: phi,
      azimuth,
      prevSmoothTime: controls.smoothTime,
    };
    controls.smoothTime = DRAG_SMOOTH_TIME;
    if (fromRing) controls.rotateAzimuthTo(azimuth, true);
    setDragging(true);
  }

  function handleRingPointerMove(event) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const controls = getControls();
    if (!controls) return;
    event.preventDefault();
    const phi = pointerAngle(event);
    drag.azimuth += knobDeltaToAzimuth(wrapAngle(phi - drag.phiPrev));
    drag.phiPrev = phi;
    controls.rotateAzimuthTo(drag.azimuth, true);
  }

  // Idempotent: pointerup is followed by lostpointercapture.
  function handleRingPointerEnd(event) {
    const drag = dragRef.current;
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    dragRef.current = null;
    const controls = getControls();
    if (controls) {
      // Snap to the exact pose the drag reached (the transition settles a
      // few mrad off, like animateToTopDown).
      controls.rotateAzimuthTo(drag.azimuth, false);
      controls.smoothTime = drag.prevSmoothTime;
    }
    setDragging(false);
  }

  const ringHandlers = (fromRing) => ({
    onPointerDown: (e) => handleRingPointerDown(e, fromRing),
    onPointerMove: handleRingPointerMove,
    onPointerUp: handleRingPointerEnd,
    onPointerCancel: handleRingPointerEnd,
    onLostPointerCapture: handleRingPointerEnd,
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => setHovered(false),
  });

  const grabCursor = dragging ? "grabbing" : "grab";

  // render

  return (
    <Box
      data-capture-hide
      sx={{
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        bgcolor: hovered || dragging ? "rgba(255,255,255,0.55)" : "transparent",
        transition: "background-color 0.15s ease",
        userSelect: "none",
        // Only the axis ends, the ring and the knob catch the pointer: the
        // rest of the disc lets the canvas underneath receive navigation /
        // selection events.
        pointerEvents: "none",
        ...sx,
      }}
    >
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Orientation des axes"
        style={{ display: "block", pointerEvents: "none" }}
      >
        {/* Orbit ring: the visible stroke, then a wide invisible band that
            catches the pointer anywhere along the ring. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(0,0,0,0.28)"
          strokeWidth={1.5}
          style={{ pointerEvents: "none" }}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="transparent"
          strokeWidth={RING_HIT_WIDTH}
          style={{
            pointerEvents: "stroke",
            cursor: grabCursor,
            touchAction: "none",
          }}
          {...ringHandlers(true)}
        >
          <title>{orbitRingS}</title>
        </circle>
        {/* Lines first (positive ends only), ordered by depth with the ends. */}
        {ends.map((end) =>
          end.sign > 0 ? (
            <line
              key={`line${end.id}`}
              x1={CENTER}
              y1={CENTER}
              x2={end.x}
              y2={end.y}
              stroke={end.color}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={end.depth < 0 ? 0.55 : 1}
            />
          ) : null
        )}
        {ends.map((end) => {
          const positive = end.sign > 0;
          const r = positive ? END_RADIUS : NEG_END_RADIUS;
          const dim = end.depth < 0 ? 0.55 : 1;
          return (
            <g
              key={end.id}
              onClick={() => handleEndClick(end)}
              onPointerEnter={() => setHovered(true)}
              onPointerLeave={() => setHovered(false)}
              style={{ cursor: "pointer", pointerEvents: "auto" }}
              opacity={dim}
            >
              <title>{viewAlongS(end.id)}</title>
              <circle
                cx={end.x}
                cy={end.y}
                r={r}
                fill={positive ? end.color : "rgba(255,255,255,0.7)"}
                stroke={end.color}
                strokeWidth={positive ? 0 : 1.5}
              />
              {positive && (
                <text
                  x={end.x}
                  y={end.y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontWeight={700}
                  fontFamily="system-ui, sans-serif"
                  fill="#fff"
                  style={{ pointerEvents: "none" }}
                >
                  {end.key}
                </text>
              )}
            </g>
          );
        })}
        {/* Orbit knob, last so it paints over everything. Z colour: it turns
            the view around the user's Z axis. */}
        {knob && (
          <circle
            cx={knob.cx}
            cy={knob.cy}
            r={KNOB_RADIUS}
            fill={knob.color}
            stroke="#fff"
            strokeWidth={2}
            style={{
              pointerEvents: "auto",
              cursor: grabCursor,
              touchAction: "none",
            }}
            {...ringHandlers(false)}
          >
            <title>{orbitRingS}</title>
          </circle>
        )}
      </svg>
    </Box>
  );
}
