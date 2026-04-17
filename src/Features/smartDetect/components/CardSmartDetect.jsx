import { useDispatch, useSelector } from "react-redux";

import {
  setSmartDetectEnabled,
  setStripDetectionMultiple,
  setStripDetectionOrientation,
} from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Checkbox,
  Paper,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { keyframes } from "@emotion/react";

import ShortcutBadge from "./ShortcutBadge";

// Flashing neon-green pulse used on the "Espace" badge when a detection
// is available for validation.
const detectionPulse = keyframes`
  0%   { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
  50%  { background-color: #00ff0066; box-shadow: 0 0 10px #00ff00; }
  100% { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
`;

// Fixed cell width used by every ToggleButton inside the card so narrow
// icons (Portrait aspect, Vertical orientation) don't produce a smaller
// button than their wide counterparts.
const TOGGLE_CELL = { width: 36, height: 28, p: 0 };

function OrientationIcon({ orientation }) {
  const dims =
    orientation === "H" ? { width: 16, height: 4 } : { width: 4, height: 16 };
  return (
    <Box
      sx={{
        ...dims,
        bgcolor: "action.disabled",
        borderRadius: "1px",
      }}
    />
  );
}


export default function CardSmartDetect({ showOrientation = true }) {
  // data

  const dispatch = useDispatch();
  const smartDetectEnabled = useSelector(
    (s) => s.mapEditor.smartDetectEnabled
  );
  const stripDetectionMultiple = useSelector(
    (s) => s.mapEditor.stripDetectionMultiple
  );
  const stripDetectionOrientation = useSelector(
    (s) => s.mapEditor.stripDetectionOrientation
  );
  const smartDetectionPresent = useSelector(
    (s) => s.mapEditor.smartDetectionPresent
  );

  // handlers

  const handleToggle = (_e, checked) => {
    dispatch(setSmartDetectEnabled(checked));
  };

  const handleMultipleChange = (_e, checked) => {
    dispatch(setStripDetectionMultiple(checked));
  };

  const handleOrientationChange = (_e, next) => {
    if (!next) return;
    dispatch(setStripDetectionOrientation(next));
  };

  // render

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 1,
        bgcolor: "background.paper",
      }}
    >
      {/* Header: title + Actif switch + A shortcut */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: smartDetectEnabled ? 0.5 : 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            color: "text.secondary",
            letterSpacing: 0.5,
            flex: 1,
          }}
        >
          Détection auto.
        </Typography>
        <Switch
          size="small"
          checked={smartDetectEnabled}
          onChange={handleToggle}
        />
        <ShortcutBadge>A</ShortcutBadge>
      </Box>

      {/* Options — only visible when smart detect is active */}
      {smartDetectEnabled && (
        <>
          {/* Détection multiple */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Checkbox
              size="small"
              checked={stripDetectionMultiple}
              onChange={handleMultipleChange}
            />
            <Typography variant="body2" sx={{ flex: 1 }}>
              Détection multiple
            </Typography>
          </Box>

          {/* Orientation (H / V) — only for strip-like modes */}
          {showOrientation && (
            <Box
              sx={{
                mt: 0.5,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                Orientation
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={stripDetectionOrientation}
                exclusive
                onChange={handleOrientationChange}
                aria-label="Orientation"
              >
                <Tooltip title="Horizontale">
                  <ToggleButton value="H" sx={TOGGLE_CELL}>
                    <OrientationIcon orientation="H" />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title="Verticale">
                  <ToggleButton value="V" sx={TOGGLE_CELL}>
                    <OrientationIcon orientation="V" />
                  </ToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
              <ShortcutBadge>O</ShortcutBadge>
            </Box>
          )}

          {/* Valider la détection — flashes when a detection is available */}
          <Box
            sx={{
              mt: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>
              Valider la détection
            </Typography>
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 56,
                height: 22,
                px: 0.5,
                borderRadius: "6px",
                border: "1px solid",
                borderColor: smartDetectionPresent ? "#00aa00" : "text.disabled",
                backgroundColor: smartDetectionPresent
                  ? undefined
                  : (theme) => theme.palette.action.hover,
                borderBottomWidth: "3px",
                color: smartDetectionPresent ? "#000" : "text.primary",
                fontFamily: "monospace",
                fontWeight: "bold",
                fontSize: "0.7rem",
                lineHeight: 1,
                animation: smartDetectionPresent
                  ? `${detectionPulse} 0.8s ease-in-out infinite`
                  : "none",
              }}
            >
              Espace
            </Box>
          </Box>
        </>
      )}
    </Paper>
  );
}
