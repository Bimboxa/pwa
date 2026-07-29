import { useEffect, useState, useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import { getShootState, subscribeShoot } from "../services/shootAimStore";
import { JET_MODES } from "../services/shootSprayController";

// Base placement of the RPG image: centered, pushed right by 3/4 of its
// width, and tilted back (top away from the viewer) so the gun reads as
// aimed at the crosshair. Keyframes must repeat the full chain (a keyframe
// transform replaces the base one), hence this helper.
const rpgTransform = (dxPx, dyPx) =>
  `translate(calc(25% + ${dxPx}px), ${dyPx}px) perspective(800px) rotateX(14deg)`;

// FPS-style HUD accent (distance + nozzle readout under the crosshair).
const HUD_ACCENT = "#7BE8FF";
const HUD_DIM = "rgba(255,255,255,0.35)";

const JET_MODE_LABELS = {
  CONE: "Conique",
  FLAT_H: "Plat horizontal",
  FLAT_V: "Plat vertical",
};

// Walk-mode weapon overlay shown at the bottom of the 3D view: the
// org-configured RPG image (features.walkMode.rpgImageUrl, resolved from
// Data/<orga>/ by resolveAppConfig) bottom-center, plus a crosshair marking
// the screen-center fire target with a game-style HUD under it (distance to
// the aimed surface + nozzle shape/aperture, tuned with B/P/M). Without a
// resolved image, only the crosshair and HUD are displayed. Idle-sways,
// recoils while spraying (firingUntil from the shootAimStore). Pure DOM,
// pointer-transparent.
export default function ShootLanceOverlayThreed() {
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  const rpgImageUrl = useSelector(
    (s) => s.appConfig.value?.features?.walkMode?.rpgImageUrl
  );

  const { firingUntil, jetMode, spreadDeg, targetDistM } = useSyncExternalStore(
    subscribeShoot,
    getShootState
  );

  // Firing flag re-derived when the spray ends (recoil animation stops).
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

  if (!walkActive) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2,
        // Full placement chain in every keyframe, see rpgTransform.
        "@keyframes rpgSway": {
          from: { transform: rpgTransform(-4, 0) },
          to: { transform: rpgTransform(4, 0) },
        },
        "@keyframes rpgRecoil": {
          from: { transform: rpgTransform(0, 14) },
          to: { transform: rpgTransform(0, 0) },
        },
        "@keyframes rpgShake": {
          from: { transform: rpgTransform(-2, 1) },
          to: { transform: rpgTransform(2, -1) },
        },
      }}
    >
      {rpgImageUrl && <RpgWeapon url={rpgImageUrl} firing={firing} />}
      <Crosshair />
      {/* jetMode is seeded by useWalkMode right after the spray controller
          is built — the guard covers the first render before that. */}
      {jetMode && (
        <JetHud
          jetMode={jetMode}
          spreadDeg={spreadDeg}
          targetDistM={targetDistM}
        />
      )}
    </Box>
  );
}

// Game-style readout under the crosshair: live distance to the aimed
// surface, the three nozzle shapes with the active one highlighted (footprint
// glyphs: round patch / horizontal stripe / vertical stripe), the full
// nozzle aperture (2 x the physics half-angle) and the tuning keys.
function JetHud({ jetMode, spreadDeg, targetDistM }) {
  return (
    <Box
      sx={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translateX(-50%)",
        mt: "22px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        fontFamily: "'Roboto Mono', 'Courier New', monospace",
        textShadow: "0 0 6px rgba(123,232,255,0.35)",
        "@keyframes hudPop": {
          from: { transform: "scale(1.4)" },
          to: { transform: "scale(1)" },
        },
      }}
    >
      <Box
        sx={{
          fontSize: 14,
          letterSpacing: 1,
          color: targetDistM == null ? HUD_DIM : HUD_ACCENT,
        }}
      >
        {targetDistM == null ? "--- m" : `${targetDistM.toFixed(1)} m`}
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: "rgba(8,14,20,0.55)",
          border: "1px solid rgba(123,232,255,0.25)",
        }}
      >
        {JET_MODES.map((mode) => (
          <JetModeChip
            // Remount the chip that just became active so its pop
            // animation replays on every mode change.
            key={mode === jetMode ? `${mode}-active` : mode}
            mode={mode}
            active={mode === jetMode}
          />
        ))}
        <Box
          sx={{
            fontSize: 12,
            minWidth: 42,
            textAlign: "right",
            color: HUD_ACCENT,
          }}
        >
          {(2 * spreadDeg).toFixed(1)}°
        </Box>
      </Box>
      <Box
        sx={{
          fontSize: 10,
          color: "rgba(255,255,255,0.45)",
          textShadow: "none",
        }}
      >
        [B] buse · [P]/[M] ouverture
      </Box>
    </Box>
  );
}

function JetModeChip({ mode, active }) {
  return (
    <Box
      aria-label={JET_MODE_LABELS[mode]}
      sx={{
        width: 26,
        height: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 0.75,
        border: active ? `1px solid ${HUD_ACCENT}` : "1px solid transparent",
        bgcolor: active ? "rgba(123,232,255,0.12)" : "transparent",
        animation: active ? "hudPop 160ms ease-out" : "none",
      }}
    >
      <JetModeGlyph mode={mode} active={active} />
    </Box>
  );
}

// Footprint of the jet on the aimed surface: disc for the cone, stripes for
// the flat fans.
function JetModeGlyph({ mode, active }) {
  const fill = active ? HUD_ACCENT : HUD_DIM;
  return (
    <Box component="svg" viewBox="0 0 20 20" sx={{ width: 16, height: 16 }}>
      {mode === "CONE" && <circle cx="10" cy="10" r="5.5" fill={fill} />}
      {mode === "FLAT_H" && (
        <rect x="3" y="8.5" width="14" height="3" rx="1.5" fill={fill} />
      )}
      {mode === "FLAT_V" && (
        <rect x="8.5" y="3" width="3" height="14" rx="1.5" fill={fill} />
      )}
    </Box>
  );
}

function RpgWeapon({ url, firing }) {
  return (
    <Box
      component="img"
      src={url}
      alt=""
      // Queried at fire time (useWalkMode) to anchor the spray origin on the
      // gun nozzle (features.walkMode.muzzleAnchor, fractions of this rect).
      data-walk-rpg-weapon="true"
      sx={{
        position: "absolute",
        left: "50%",
        bottom: -6,
        transform: rpgTransform(0, 0),
        // The tilt pivots around the bottom edge (the held end of the gun).
        transformOrigin: "50% 100%",
        // Percentages resolve against the 3D view (absolutely positioned
        // inside the inset-0 overlay).
        maxHeight: "42%",
        maxWidth: "70%",
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.45))",
        animation: firing
          ? "rpgRecoil 120ms ease-out, rpgShake 90ms linear 120ms infinite alternate"
          : "rpgSway 3s ease-in-out infinite alternate",
      }}
    />
  );
}

function Crosshair() {
  return (
    <Box
      component="svg"
      viewBox="0 0 16 16"
      sx={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 16,
        height: 16,
        filter: "drop-shadow(0 0 1px rgba(0,0,0,0.8))",
      }}
    >
      <line
        x1="8"
        y1="1"
        x2="8"
        y2="15"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
      />
      <line
        x1="1"
        y1="8"
        x2="15"
        y2="8"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
      />
    </Box>
  );
}
