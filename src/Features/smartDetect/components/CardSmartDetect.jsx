import { useDispatch, useSelector } from "react-redux";

import {
  setSmartDetectEnabled,
  setStripDetectionMultiple,
  setSmartDetectMode,
  setSegmentSnapDirection,
} from "Features/mapEditor/mapEditorSlice";

import { Box, Checkbox, Paper, Switch, Typography } from "@mui/material";

import ShortcutBadge from "./ShortcutBadge";
import BadgeSpaceCommit from "./BadgeSpaceCommit";
import { SEGMENT_SNAP_MODES } from "Features/mapEditor/utils/getEffectiveDetectionMode";

export default function CardSmartDetect() {
  // strings

  const surfaceHoverS = "Activer au survol d'une zone fermée";
  const segmentHoverS = "Activer au survol d'un segment de même épaisseur";

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
  const segmentSnapDirection = useSelector(
    (s) => s.mapEditor.segmentSnapDirection
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

  // SEGMENT tool → dark-band snapping around the cursor (SEGMENT_SNAP):
  // hover-only detection, with R toggling the proposed H/V orientation.
  const isSegmentSnapMode = SEGMENT_SNAP_MODES.includes(enabledDrawingMode);

  // Surface / segment modes only detect on hover: the « Espace » validation
  // row is meaningful once their switch is on. The rectangle modes keep it
  // visible (the global A detection validates with Espace too).
  const showValidateRow =
    isSurfaceMode || isSegmentSnapMode ? hoverActive : true;

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

  // Surface / segment hover switch — same effect as the S / J hotkeys
  // (InteractionLayer): on arms the HOVER mode, off stops the detection.
  const handleHoverSwitchChange = (e) => {
    if (e.target.checked) {
      handleSelectHover();
    } else {
      dispatch(setSmartDetectEnabled(false));
    }
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

  // SEGMENT tool direction — same cycle as the D key: auto → V → H → auto.
  const handleCycleDirection = () => {
    const next =
      segmentSnapDirection === null
        ? "V"
        : segmentSnapDirection === "V"
          ? "H"
          : null;
    dispatch(setSegmentSnapDirection(next));
  };

  const directionLabel =
    segmentSnapDirection === "V"
      ? "Verticale"
      : segmentSnapDirection === "H"
        ? "Horizontale"
        : "Auto";

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

      {!isSurfaceMode && !isSegmentSnapMode && (
        <ModeRow
          label="Globale"
          shortcut="A"
          active={globalActive}
          onClick={handleSelectGlobal}
        />
      )}

      {isSurfaceMode || isSegmentSnapMode ? (
        <SwitchRow
          label={isSegmentSnapMode ? segmentHoverS : surfaceHoverS}
          shortcut={isSegmentSnapMode ? "J" : "S"}
          checked={hoverActive}
          onChange={handleHoverSwitchChange}
        />
      ) : (
        <ModeRow
          label="Au survol"
          shortcut="S"
          active={hoverActive}
          onClick={handleSelectHover}
        />
      )}

      {isPolylineClickMode && (
        <ModeRow
          label="Vectoriser"
          shortcut="V"
          active={vectorActive}
          onClick={handleSelectVector}
        />
      )}

      {hoverActive && !isSurfaceMode && !isSegmentSnapMode && (
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

      {hoverActive && isSegmentSnapMode && (
        <Box
          onClick={handleCycleDirection}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            pl: 3,
            py: 0.25,
            borderRadius: 1,
            cursor: "pointer",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography variant="body2" sx={{ flex: 1 }}>
            Direction : <b>{directionLabel}</b>
          </Typography>
          <ShortcutBadge>D</ShortcutBadge>
        </Box>
      )}

      {showValidateRow && (
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
          <BadgeSpaceCommit active={smartDetectionPresent} />
        </Box>
      )}
    </Paper>
  );
}

// Switch + shortcut badge row (surface / segment hover detection).
function SwitchRow({ label, shortcut, checked, onChange }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 0.5,
        py: 0.25,
      }}
    >
      <Typography variant="body2" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <ShortcutBadge>{shortcut}</ShortcutBadge>
      <Switch size="small" checked={checked} onChange={onChange} />
    </Box>
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
