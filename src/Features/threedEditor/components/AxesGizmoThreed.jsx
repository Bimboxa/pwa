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
// Pure DOM/SVG overlay: it never touches the renderer. It follows the camera
// through SceneManager.addRenderListener (fired after every renderScene) and
// drives the camera through ControlsManager.animateToTopDown, the primitive
// the face-on framings already use. The displayed frame yaw (axesSettings)
// rotates the axes only — purely visual.

const SIZE = 96;
const CENTER = SIZE / 2;
const RADIUS = 34; // distance of the axis ends from the centre (px)
const END_RADIUS = 9; // positive end circle (px)
const NEG_END_RADIUS = 6; // negative end circle (px)
const QUAT_EPSILON = 1e-4;

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

export default function AxesGizmoThreed({ threedEditorRef, sx }) {
  // strings

  const viewAlongS = (id) => `Vue selon ${id}`;

  // data

  const yawDeg = useSelector((s) => s.threedEditor.axesSettings.yawDeg);

  // state

  const [ends, setEnds] = useState([]);
  const [hovered, setHovered] = useState(false);

  // helpers

  const scratchRef = useRef({
    inv: new Quaternion(),
    v: new Vector3(),
    lastQuat: new Quaternion(0, 0, 0, 0),
    lastYaw: null,
  });

  const refresh = useCallback(
    (force) => {
      const camera = threedEditorRef.current?.sceneManager?.camera;
      if (!camera) return;
      const scratch = scratchRef.current;
      const q = camera.quaternion;
      const same =
        !force &&
        scratch.lastYaw === yawDeg &&
        Math.abs(scratch.lastQuat.x - q.x) < QUAT_EPSILON &&
        Math.abs(scratch.lastQuat.y - q.y) < QUAT_EPSILON &&
        Math.abs(scratch.lastQuat.z - q.z) < QUAT_EPSILON &&
        Math.abs(scratch.lastQuat.w - q.w) < QUAT_EPSILON;
      if (same) return;
      scratch.lastQuat.copy(q);
      scratch.lastYaw = yawDeg;
      setEnds(projectAxisEnds(q, yawDeg, scratch));
    },
    [threedEditorRef, yawDeg]
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

  // render

  return (
    <Box
      data-capture-hide
      sx={{
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        bgcolor: hovered ? "rgba(255,255,255,0.55)" : "transparent",
        transition: "background-color 0.15s ease",
        userSelect: "none",
        // Only the axis ends catch the pointer: the rest of the disc lets
        // the canvas underneath receive navigation / selection events.
        pointerEvents: "none",
        ...sx,
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Orientation des axes"
        style={{ display: "block", pointerEvents: "none" }}
      >
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
      </svg>
    </Box>
  );
}
