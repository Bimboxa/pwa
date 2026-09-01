import { useSelector, useDispatch } from "react-redux";

import { setDisable3D } from "Features/appConfig/appConfigSlice";

import setDisable3DInLocalStorage from "Features/appConfig/services/setDisable3DInLocalStorage";

import { Box, ButtonBase, Switch, Typography } from "@mui/material";

// 3D activation card shown in the work area of the Modules & outils mockup:
// an isometric scene as background (inline SVG — no binary asset), a switch
// overlay. Toggles the device-local disable3D preference (same state as the
// "Désactiver la 3D" switch of Données & préférences, inverted wording).
export default function CardToggle3d() {
  const dispatch = useDispatch();

  // data

  const disable3D = useSelector((s) => s.appConfig.disable3D);

  // helpers

  const enabled = !disable3D;

  // handlers

  function handleToggle() {
    const next = !disable3D;
    dispatch(setDisable3D(next));
    setDisable3DInLocalStorage(next);
  }

  // render

  return (
    <ButtonBase
      onClick={handleToggle}
      sx={{
        width: 300,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: 2,
        display: "block",
        textAlign: "left",
        bgcolor: "background.paper",
      }}
    >
      {/* background — isometric 3D scene */}
      <Box
        sx={{
          height: 140,
          position: "relative",
          filter: enabled ? "none" : "grayscale(1)",
          opacity: enabled ? 1 : 0.45,
          transition: "all 0.2s ease",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 300 140"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* sky */}
          <defs>
            <linearGradient id="cardToggle3dSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cfe4f7" />
              <stop offset="100%" stopColor="#eef6fc" />
            </linearGradient>
          </defs>
          <rect width="300" height="140" fill="url(#cardToggle3dSky)" />
          {/* ground */}
          <polygon points="0,105 300,85 300,140 0,140" fill="#e4e9e4" />
          {/* shadow */}
          <ellipse cx="158" cy="122" rx="92" ry="12" fill="#c9d2d8" opacity="0.6" />
          {/* back volume */}
          <g stroke="#54636f" strokeWidth="1" strokeLinejoin="round">
            <polygon points="78,62 120,44 162,62 120,80" fill="#fbfcfd" />
            <polygon points="78,62 120,80 120,118 78,100" fill="#d9e3ec" />
            <polygon points="120,80 162,62 162,100 120,118" fill="#bccbd9" />
          </g>
          {/* front volume */}
          <g stroke="#46545f" strokeWidth="1.2" strokeLinejoin="round">
            <polygon points="140,52 196,30 252,52 196,74" fill="#ffffff" />
            <polygon points="140,52 196,74 196,124 140,102" fill="#dbe5ee" />
            <polygon points="196,74 252,52 252,102 196,124" fill="#b5c6d6" />
            {/* roof edge */}
            <line x1="140" y1="52" x2="196" y2="74" />
          </g>
          {/* openings on the front-left face */}
          <g fill="#8ea6ba">
            <polygon points="150,68 162,73 162,89 150,84" />
            <polygon points="168,75 180,80 180,96 168,91" />
          </g>
        </svg>
      </Box>

      {/* overlay — label + switch */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box>
          <Typography variant="body2">Vue 3D</Typography>
          <Typography variant="caption" color="text.secondary">
            {enabled ? "Activée" : "Désactivée"}
          </Typography>
        </Box>
        {/* the whole card is the click target; the switch just displays state */}
        <Switch size="small" checked={enabled} sx={{ pointerEvents: "none" }} />
      </Box>
    </ButtonBase>
  );
}
