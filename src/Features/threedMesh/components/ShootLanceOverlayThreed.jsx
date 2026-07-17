import { useEffect, useState, useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import { getShootState, subscribeShoot } from "../services/shootAimStore";

// Base placement of the RPG image: centered, pushed right by 3/4 of its
// width, and tilted back (top away from the viewer) so the gun reads as
// aimed at the crosshair. Keyframes must repeat the full chain (a keyframe
// transform replaces the base one), hence this helper.
const rpgTransform = (dxPx, dyPx) =>
  `translate(calc(25% + ${dxPx}px), ${dyPx}px) perspective(800px) rotateX(14deg)`;

// Walk-mode weapon overlay shown at the bottom of the 3D view: the
// org-configured RPG image (features.walkMode.rpgImageUrl, resolved from
// Data/<orga>/ by resolveAppConfig) bottom-center, plus a crosshair marking
// the screen-center fire target. Without a resolved image, only the
// crosshair is displayed. Idle-sways, recoils while spraying (firingUntil
// from the shootAimStore). Pure DOM, pointer-transparent.
export default function ShootLanceOverlayThreed() {
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  const rpgImageUrl = useSelector(
    (s) => s.appConfig.value?.features?.walkMode?.rpgImageUrl
  );

  const { firingUntil } = useSyncExternalStore(subscribeShoot, getShootState);

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
