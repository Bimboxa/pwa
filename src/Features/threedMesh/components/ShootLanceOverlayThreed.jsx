import { useEffect, useState, useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import {
  WALK_TOOLS,
  getShootState,
  subscribeShoot,
} from "../services/shootAimStore";
import { JET_MODES } from "../services/shootSprayController";

// Base placement of the weapon image: centered, pushed right by 3/4 of its
// width, and tilted back (top away from the viewer) so the gun reads as
// aimed at the crosshair. Keyframes must repeat the full chain (a keyframe
// transform replaces the base one), hence this helper.
const rpgTransform = (dxPx, dyPx) =>
  `translate(calc(25% + ${dxPx}px), ${dyPx}px) perspective(800px) rotateX(14deg)`;

// Sci-fi HUD palette: dark glass panels, one luminous cyan accent (readable
// on white plans AND on dark scans, unlike the previous white band), soft
// glow on the reticle readouts.
const ACCENT = "#5de4ff";
const ACCENT_DIM = "rgba(93, 228, 255, 0.45)";
const ACCENT_FAINT = "rgba(93, 228, 255, 0.14)";
const TEXT = "rgba(232, 244, 255, 0.92)";
const TEXT_DIM = "rgba(232, 244, 255, 0.55)";
const PANEL_BG = "rgba(8, 12, 18, 0.66)";
const GLOW = `0 0 6px rgba(93, 228, 255, 0.85), 0 0 1px #000`;
const MONO = "ui-monospace, 'SF Mono', Menlo, 'Roboto Mono', monospace";
// Chamfered corners (top-right / bottom-left) of the panels.
const CHAMFER =
  "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))";

const JET_MODE_LABELS = {
  CONE: "Conique",
  FLAT_H: "Plat horizontal",
  FLAT_V: "Plat vertical",
};

const TOOL_LABELS = {
  LANCE: "Lance",
  MEASURE: "Télémètre",
};

// Walk-mode overlay of the 3D view: the org-configured weapon image of the
// current tool (features.walkMode.rpgImageUrl for the lance,
// .measureImageUrl for the laser meter, both resolved from Data/<orga>/ by
// resolveAppConfig) bottom-center, a reticle at the screen center with the
// live readouts under it (distance to the aimed surface, live measure
// length), and a game-style panel in the bottom-left corner — clear of the
// weapon — with the tool tabs, the tool body (nozzle shape / aperture tuned
// with B / + / -, or the measure progress) and the key legend. Without a
// resolved image, only the reticle and the panel are displayed. The weapon
// idle-sways and recoils while spraying (firingUntil from the
// shootAimStore). Pure DOM, pointer-transparent.
export default function ShootLanceOverlayThreed() {
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  const rpgImageUrl = useSelector(
    (s) => s.appConfig.value?.features?.walkMode?.rpgImageUrl
  );
  const measureImageUrl = useSelector(
    (s) => s.appConfig.value?.features?.walkMode?.measureImageUrl
  );

  const {
    tool,
    firingUntil,
    jetMode,
    spreadDeg,
    targetDistM,
    measureHasStart,
    measureLiveM,
    measureCount,
  } = useSyncExternalStore(subscribeShoot, getShootState);

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

  const weaponUrl = tool === "MEASURE" ? measureImageUrl : rpgImageUrl;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2,
        fontFamily: MONO,
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
        "@keyframes hudPop": {
          from: { transform: "scale(1.25)", opacity: 0.4 },
          to: { transform: "scale(1)", opacity: 1 },
        },
        "@keyframes hudBlink": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.35 },
        },
      }}
    >
      {/* Remount on tool switch so the sway restarts with the new image. */}
      {weaponUrl && (
        <WeaponImage
          key={tool}
          url={weaponUrl}
          firing={tool === "LANCE" && firing}
        />
      )}
      <Reticle armed={tool === "MEASURE" && measureHasStart} />
      <ReticleReadout
        tool={tool}
        targetDistM={targetDistM}
        measureHasStart={measureHasStart}
        measureLiveM={measureLiveM}
      />
      {/* jetMode is seeded by useWalkMode right after the spray controller
          is built — the guard covers the first render before that. */}
      {jetMode && (
        <HudPanel
          tool={tool}
          jetMode={jetMode}
          spreadDeg={spreadDeg}
          targetDistM={targetDistM}
          measureHasStart={measureHasStart}
          measureCount={measureCount}
        />
      )}
    </Box>
  );
}

const formatM = (m, decimals = 1) =>
  m == null ? "--.- m" : `${m.toFixed(decimals)} m`;

// ----- reticle ---------------------------------------------------------------

// Four ticks with a central gap + a dot; the ring appears while a measure
// is armed (first point shot).
function Reticle({ armed }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 40 40"
      sx={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 40,
        height: 40,
        color: ACCENT,
        filter: "drop-shadow(0 0 3px rgba(93,228,255,0.9))",
      }}
    >
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="20" y1="2" x2="20" y2="11" />
        <line x1="20" y1="29" x2="20" y2="38" />
        <line x1="2" y1="20" x2="11" y2="20" />
        <line x1="29" y1="20" x2="38" y2="20" />
      </g>
      <circle cx="20" cy="20" r="1.6" fill="currentColor" />
      {armed && (
        <circle
          cx="20"
          cy="20"
          r="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.8"
        />
      )}
    </Box>
  );
}

// Live numbers right under the reticle: the measure length while a first
// point is armed (big), the distance to the aimed surface (small; dimmed
// when aiming the void).
function ReticleReadout({ tool, targetDistM, measureHasStart, measureLiveM }) {
  const showLive = tool === "MEASURE" && measureHasStart;
  return (
    <Box
      sx={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translateX(-50%)",
        mt: "26px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
        color: ACCENT,
        textShadow: GLOW,
        letterSpacing: 1,
        whiteSpace: "nowrap",
      }}
    >
      {showLive && (
        <Box sx={{ fontSize: 16, fontWeight: 700 }}>
          {formatM(measureLiveM, 2)}
        </Box>
      )}
      <Box
        sx={{
          fontSize: showLive ? 11 : 13,
          opacity: targetDistM == null ? 0.45 : showLive ? 0.75 : 1,
        }}
      >
        {formatM(targetDistM)}
      </Box>
    </Box>
  );
}

// ----- bottom-left panel -----------------------------------------------------

function HudPanel({
  tool,
  jetMode,
  spreadDeg,
  targetDistM,
  measureHasStart,
  measureCount,
}) {
  return (
    <Box
      sx={{
        position: "absolute",
        left: 20,
        bottom: 20,
        minWidth: 236,
        px: 1.5,
        pt: 1.25,
        pb: 1.25,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        color: TEXT,
        bgcolor: PANEL_BG,
        backdropFilter: "blur(6px)",
        clipPath: CHAMFER,
        boxShadow: `inset 0 0 0 1px ${ACCENT_DIM}`,
        fontSize: 11,
        letterSpacing: 0.5,
        whiteSpace: "nowrap",
        // Luminous top edge.
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          right: 12,
          height: 2,
          background: `linear-gradient(90deg, ${ACCENT}, transparent)`,
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            fontSize: 9,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: ACCENT,
            opacity: 0.85,
          }}
        >
          Première personne
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Key>P</Key>
        <Box sx={{ fontSize: 9, color: TEXT_DIM }}>quitter</Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {WALK_TOOLS.map((key) => (
          <ToolTab
            // Remount the tab that just became active so its pop animation
            // replays on every tool switch.
            key={key === tool ? `${key}-active` : key}
            label={TOOL_LABELS[key]}
            active={key === tool}
          />
        ))}
        <Box sx={{ flexGrow: 1 }} />
        <Key>O</Key>
      </Box>

      {tool === "MEASURE" ? (
        <MeasureBody
          targetDistM={targetDistM}
          measureHasStart={measureHasStart}
          measureCount={measureCount}
        />
      ) : (
        <JetBody jetMode={jetMode} spreadDeg={spreadDeg} />
      )}

      <Legend />
    </Box>
  );
}

// Lance: the three nozzle shapes with the active one highlighted (footprint
// glyphs: round patch / horizontal stripe / vertical stripe), the full
// nozzle aperture (2 x the physics half-angle) and the tuning keys.
function JetBody({ jetMode, spreadDeg }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {JET_MODES.map((mode) => (
          <JetModeChip
            key={mode === jetMode ? `${mode}-active` : mode}
            mode={mode}
            active={mode === jetMode}
          />
        ))}
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ fontSize: 13, color: ACCENT, textShadow: GLOW }}>
          {(2 * spreadDeg).toFixed(1)}°
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Key>Espace</Key>
        <Hint>projeter</Hint>
        <Key>B</Key>
        <Hint>buse</Hint>
        <Key>+</Key>
        <Key>−</Key>
        <Hint>ouverture</Hint>
      </Box>
    </Box>
  );
}

// Laser meter: the next expected shot and the number of measures kept in
// the scene (the live length lives under the reticle).
function MeasureBody({ targetDistM, measureHasStart, measureCount }) {
  const noTarget = targetDistM == null;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <StepDot done={measureHasStart} active={!measureHasStart} />
        <StepDot done={false} active={measureHasStart} />
        <Box
          sx={{
            fontSize: 11,
            color: noTarget ? TEXT_DIM : ACCENT,
            textShadow: noTarget ? "none" : GLOW,
            animation:
              measureHasStart && !noTarget ? "hudBlink 1.2s infinite" : "none",
          }}
        >
          {noTarget
            ? "Visez une surface"
            : measureHasStart
              ? "Point 2 : tirez"
              : "Point 1 : tirez"}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ fontSize: 10, color: TEXT_DIM }}>
          {measureCount} mesure{measureCount > 1 ? "s" : ""}
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Key>Espace</Key>
        <Hint>tirer</Hint>
        <Key>⌫</Key>
        <Hint>effacer</Hint>
      </Box>
    </Box>
  );
}

function Legend() {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 0.5,
        rowGap: 0.5,
        pt: 0.75,
        borderTop: `1px solid ${ACCENT_FAINT}`,
        fontSize: 10,
      }}
    >
      <Key>↑↓←→</Key>
      <Hint>marcher</Hint>
      <Key>Q</Key>
      <Key>S</Key>
      <Hint>regard</Hint>
      <Key>Z</Key>
      <Key>W</Key>
      <Hint>monter / descendre</Hint>
      <Key>R</Key>
      <Hint>course</Hint>
    </Box>
  );
}

// ----- atoms -------------------------------------------------------------------

function Key({ children }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 16,
        height: 16,
        px: "4px",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: ACCENT,
        border: `1px solid ${ACCENT_DIM}`,
        borderBottomWidth: 2,
        borderRadius: "3px",
        bgcolor: "rgba(0,0,0,0.35)",
        lineHeight: 1,
      }}
    >
      {children}
    </Box>
  );
}

function Hint({ children }) {
  return (
    <Box component="span" sx={{ fontSize: 10, color: TEXT_DIM, mr: 0.5 }}>
      {children}
    </Box>
  );
}

function ToolTab({ label, active }) {
  return (
    <Box
      sx={{
        px: 1,
        height: 20,
        display: "flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: active ? "#07111a" : TEXT_DIM,
        bgcolor: active ? ACCENT : "transparent",
        border: `1px solid ${active ? ACCENT : ACCENT_DIM}`,
        boxShadow: active ? `0 0 8px ${ACCENT_DIM}` : "none",
        clipPath:
          "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
        animation: active ? "hudPop 160ms ease-out" : "none",
      }}
    >
      {label}
    </Box>
  );
}

function StepDot({ done, active }) {
  return (
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        border: `1px solid ${done || active ? ACCENT : ACCENT_DIM}`,
        bgcolor: done ? ACCENT : "transparent",
        boxShadow: active ? `0 0 6px ${ACCENT}` : "none",
      }}
    />
  );
}

function JetModeChip({ mode, active }) {
  return (
    <Box
      aria-label={JET_MODE_LABELS[mode]}
      sx={{
        width: 26,
        height: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${active ? ACCENT : ACCENT_DIM}`,
        bgcolor: active ? ACCENT_FAINT : "transparent",
        boxShadow: active ? `0 0 6px ${ACCENT_DIM}` : "none",
        animation: active ? "hudPop 160ms ease-out" : "none",
      }}
    >
      <JetModeGlyph mode={mode} active={active} />
    </Box>
  );
}

// Footprint of the jet on the aimed surface: disc for the cone, stripes for
// the flat fans. Shapes are fill="currentColor" — the sx color carries the
// active/dimmed tint.
function JetModeGlyph({ mode, active }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 20 20"
      sx={{
        width: 14,
        height: 14,
        color: active ? ACCENT : ACCENT_DIM,
      }}
    >
      {mode === "CONE" && (
        <circle cx="10" cy="10" r="5.5" fill="currentColor" />
      )}
      {mode === "FLAT_H" && (
        <rect
          x="3"
          y="8.5"
          width="14"
          height="3"
          rx="1.5"
          fill="currentColor"
        />
      )}
      {mode === "FLAT_V" && (
        <rect
          x="8.5"
          y="3"
          width="3"
          height="14"
          rx="1.5"
          fill="currentColor"
        />
      )}
    </Box>
  );
}

// Weapon image of the current tool (RPG lance / laser meter).
function WeaponImage({ url, firing }) {
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
