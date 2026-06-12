import { useDispatch, useSelector } from "react-redux";

import {
  setSmartDetectEnabled,
  setStripDetectionMultiple,
  setSmartDetectMode,
} from "Features/mapEditor/mapEditorSlice";

import { Box, Checkbox, Paper, Typography } from "@mui/material";
import { keyframes } from "@emotion/react";

import ShortcutBadge from "./ShortcutBadge";

const detectionPulse = keyframes`
  0%   { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
  50%  { background-color: #00ff0066; box-shadow: 0 0 10px #00ff00; }
  100% { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
`;

export default function CardSmartDetect() {
  // data

  const dispatch = useDispatch();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const smartDetectEnabled = useSelector((s) => s.mapEditor.smartDetectEnabled);
  const smartDetectMode = useSelector((s) => s.mapEditor.smartDetectMode);
  const stripDetectionMultiple = useSelector(
    (s) => s.mapEditor.stripDetectionMultiple
  );
  const smartDetectionPresent = useSelector(
    (s) => s.mapEditor.smartDetectionPresent
  );

  const hoverActive = smartDetectEnabled && smartDetectMode === "HOVER";
  const globalActive = smartDetectMode === "GLOBAL";
  const vectorActive = smartDetectMode === "VECTOR";

  // Surface drawing (POLYGON_CLICK) only supports hover detection: it finds the
  // closed loop of segments around the cursor (detectPolygonFromAnnotations).
  // "Globale" (OpenCV wall/pillar detector) and "Détection multiple" (strip
  // detection) don't apply, so they are hidden here.
  const isSurfaceMode = enabledDrawingMode === "POLYGON_CLICK";

  // "Vectoriser" (V) turns the H / V black wall lines into 2-point segments —
  // only meaningful in clic-clic polyline mode.
  const isPolylineClickMode = enabledDrawingMode === "POLYLINE_CLICK";

  // handlers

  // "Globale" — direct trigger isn't possible from a click (we'd need a
  // cursor position), so the row simply selects the mode. The actual run is
  // launched by pressing A on the map, which uses the cursor position at
  // that moment.
  const handleSelectGlobal = () => {
    dispatch(setSmartDetectMode("GLOBAL"));
    if (smartDetectEnabled) dispatch(setSmartDetectEnabled(false));
  };

  const handleSelectHover = () => {
    dispatch(setSmartDetectMode("HOVER"));
    dispatch(setSmartDetectEnabled(true));
  };

  // "Vectoriser" — same pattern as "Globale": the row only arms the mode,
  // the actual run is launched by pressing V on the map.
  const handleSelectVector = () => {
    dispatch(setSmartDetectMode("VECTOR"));
    if (smartDetectEnabled) dispatch(setSmartDetectEnabled(false));
  };

  const handleMultipleChange = (_e, checked) => {
    dispatch(setStripDetectionMultiple(checked));
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
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 700,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          color: "text.secondary",
          letterSpacing: 0.5,
          mb: 0.5,
        }}
      >
        Détection auto.
      </Typography>

      {!isSurfaceMode && (
        <ModeRow
          label="Globale"
          shortcut="A"
          active={globalActive}
          onClick={handleSelectGlobal}
        />
      )}

      <ModeRow
        label="Au survol"
        shortcut="S"
        active={hoverActive}
        onClick={handleSelectHover}
      />

      {isPolylineClickMode && (
        <ModeRow
          label="Vectoriser"
          shortcut="V"
          active={vectorActive}
          onClick={handleSelectVector}
        />
      )}

      {hoverActive && !isSurfaceMode && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            pl: 3,
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
      )}

      <Box
        sx={{
          mt: 0.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ flex: 1 }}>
          Valider la sélection
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
    </Paper>
  );
}

function ModeRow({ label, shortcut, active, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 0.5,
        py: 0.25,
        borderRadius: 1,
        cursor: "pointer",
        bgcolor: active ? "action.selected" : "transparent",
        "&:hover": {
          bgcolor: active ? "action.selected" : "action.hover",
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{ flex: 1, fontWeight: active ? 700 : 400 }}
      >
        {label}
      </Typography>
      <ShortcutBadge>{shortcut}</ShortcutBadge>
    </Box>
  );
}
