import { useEffect, useState, useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import {
  getShootState,
  subscribeShoot,
} from "../hooks/useShootPointerHandlers";

// Rotation clamp of the lance, degrees from vertical.
const MAX_ANGLE_DEG = 60;
// The pivot sits below the viewport edge so the arc reads as a held weapon.
const ANCHOR_BELOW_PX = 30;

// Doom-like concrete-projection lance shown at the bottom of the 3D view
// while the meshing "shoot" sub-mode is on. Aims toward the mouse (fed by
// useShootPointerHandlers through its store), idle-sways, and recoils on
// fire. Pure DOM/SVG, pointer-transparent.
export default function ShootLanceOverlayThreed() {
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const shootActive = useSelector(
    (s) => s.threedEditor.meshingMode.shootActive
  );

  const { aim, firingUntil } = useSyncExternalStore(
    subscribeShoot,
    getShootState
  );

  // Firing flag re-derived when the burst ends (recoil animation stops).
  const [firing, setFiring] = useState(false);
  useEffect(() => {
    const remaining = firingUntil - Date.now();
    if (remaining <= 0) {
      setFiring(false);
      return;
    }
    setFiring(true);
    const timeout = setTimeout(() => setFiring(false), remaining);
    return () => clearTimeout(timeout);
  }, [firingUntil]);

  if (!meshingActive || !shootActive) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2,
        "@keyframes lanceSway": {
          from: { transform: "translateX(-4px)" },
          to: { transform: "translateX(4px)" },
        },
        "@keyframes lanceRecoil": {
          from: { transform: "translateY(10px)" },
          to: { transform: "translateY(0px)" },
        },
        "@keyframes lanceShake": {
          from: { transform: "translate(-2px, 1px)" },
          to: { transform: "translate(2px, -1px)" },
        },
      }}
    >
      <LanceBody aim={aim} firing={firing} />
    </Box>
  );
}

function LanceBody({ aim, firing }) {
  // Container size to place the anchor; read once per render via ref state.
  const [el, setEl] = useState(null);

  let angle = 0;
  if (el && aim) {
    const anchorX = el.clientWidth / 2;
    const anchorY = el.clientHeight + ANCHOR_BELOW_PX;
    const rad = Math.atan2(aim.x - anchorX, anchorY - aim.y);
    angle = Math.max(
      -MAX_ANGLE_DEG,
      Math.min(MAX_ANGLE_DEG, (rad * 180) / Math.PI)
    );
  }

  return (
    <Box ref={setEl} sx={{ position: "absolute", inset: 0 }}>
      {/* Idle sway wrapper */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          bottom: -ANCHOR_BELOW_PX,
          width: 0,
          height: 0,
          animation: "lanceSway 3s ease-in-out infinite alternate",
        }}
      >
        {/* Recoil / shake wrapper */}
        <Box
          sx={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: 0,
            height: 0,
            ...(firing && {
              animation:
                "lanceRecoil 120ms ease-out, lanceShake 90ms linear 120ms infinite alternate",
            }),
          }}
        >
          <Box
            component="svg"
            viewBox="0 0 64 240"
            sx={{
              position: "absolute",
              left: -32,
              bottom: 0,
              width: 64,
              height: 240,
              transformOrigin: "50% 100%",
              transform: `rotate(${angle}deg)`,
              transition: "transform 70ms ease-out",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
            }}
          >
            <defs>
              <linearGradient id="shootLanceTube" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#c2c2c2" />
                <stop offset="0.5" stopColor="#6e6e6e" />
                <stop offset="1" stopColor="#9a9a9a" />
              </linearGradient>
              <linearGradient id="shootLanceNozzle" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#8a8a8a" />
                <stop offset="0.5" stopColor="#3f3f3f" />
                <stop offset="1" stopColor="#6b6b6b" />
              </linearGradient>
            </defs>

            {/* Hose trailing off-screen */}
            <path
              d="M32 210 C 30 228, 48 232, 62 240"
              stroke="#3a3a3a"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            {/* Tube */}
            <rect
              x="26"
              y="62"
              width="12"
              height="150"
              rx="3"
              fill="url(#shootLanceTube)"
            />
            {/* Grip */}
            <rect x="20" y="128" width="24" height="10" rx="4" fill="#c62828" />
            {/* Collar */}
            <rect x="22" y="54" width="20" height="12" rx="2" fill="#4d4d4d" />
            {/* Nozzle */}
            <polygon
              points="26,54 38,54 42,18 22,18"
              fill="url(#shootLanceNozzle)"
            />
            {/* Muzzle opening */}
            <ellipse cx="32" cy="16" rx="10" ry="4" fill="#2c2c2c" />
            <ellipse cx="32" cy="16" rx="6" ry="2.4" fill="#111" />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
