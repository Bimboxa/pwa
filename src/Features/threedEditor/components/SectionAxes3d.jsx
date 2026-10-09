import { useDispatch, useSelector } from "react-redux";

import {
  setShowAxesGizmo,
  setShowSceneAxes,
  setAxesYawDeg,
} from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  Button,
  Card,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import useSelectedBaseMap from "Features/baseMaps/hooks/useSelectedBaseMap";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";

const YAW_PRESETS_DEG = [0, 90, 180, 270];

// "Axes" card of the 3D view settings (PanelThreedProperties): orientation
// gizmo switch, in-scene axes switch and the yaw of the displayed frame.
// Device preference (threedEditor.axesSettings, localStorage). The yaw is
// purely visual: only the gizmo, the in-scene axes and the gizmo's face views
// rotate.
export default function SectionAxes3d() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Axes";
  const conventionS = "Z vertical.";
  const gizmoS = "Gizmo d'orientation";
  const gizmoHelperS =
    "En haut à droite de la vue. Cliquer sur un axe place la caméra face à lui, un second clic montre la face opposée.";
  const sceneAxesS = "Afficher les axes dans la scène";
  const orientationS = "Orientation du repère";
  const orientationHelperS =
    "Rotation autour de la verticale. Purement visuelle : le modèle et la caméra ne bougent pas.";
  const rotationLabelS = "Rotation (°)";
  const alignS = "Aligner sur le fond de plan";

  // data

  const axesSettings = useSelector((s) => s.threedEditor.axesSettings);
  const { showGizmo, showSceneAxes, yawDeg } = axesSettings;

  const selectedBaseMap = useSelectedBaseMap();
  const baseMapAngleDeg = selectedBaseMap
    ? getBaseMapTransform(selectedBaseMap).angleDeg
    : null;

  // helpers

  const presetValue = YAW_PRESETS_DEG.includes(yawDeg) ? yawDeg : null;

  // handlers

  function handleYawChange(event) {
    const v = parseFloat(event.target.value);
    if (Number.isNaN(v)) return;
    dispatch(setAxesYawDeg(v));
  }

  function handlePresetChange(_event, value) {
    if (value === null || value === undefined) return;
    dispatch(setAxesYawDeg(value));
  }

  function handleAlignOnBaseMap() {
    if (baseMapAngleDeg === null) return;
    dispatch(setAxesYawDeg(baseMapAngleDeg));
  }

  // render

  return (
    <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {titleS}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1 }}
      >
        <Box component="span" sx={{ color: AXIS_COLORS.X, fontWeight: 700 }}>
          X
        </Box>
        {" · "}
        <Box component="span" sx={{ color: AXIS_COLORS.Y, fontWeight: 700 }}>
          Y
        </Box>
        {" · "}
        <Box component="span" sx={{ color: AXIS_COLORS.Z, fontWeight: 700 }}>
          Z
        </Box>
        {` — ${conventionS}`}
      </Typography>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 0.25,
        }}
      >
        <Typography variant="body2">{gizmoS}</Typography>
        <Switch
          size="small"
          checked={showGizmo}
          onChange={(e) => dispatch(setShowAxesGizmo(e.target.checked))}
        />
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 0.5 }}
      >
        {gizmoHelperS}
      </Typography>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 0.25,
          mb: 1,
        }}
      >
        <Typography variant="body2">{sceneAxesS}</Typography>
        <Switch
          size="small"
          checked={showSceneAxes}
          onChange={(e) => dispatch(setShowSceneAxes(e.target.checked))}
        />
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {orientationS}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1 }}
      >
        {orientationHelperS}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <TextField
          size="small"
          type="number"
          label={rotationLabelS}
          value={yawDeg}
          onChange={handleYawChange}
          slotProps={{ htmlInput: { min: 0, max: 359, step: 1 } }}
          sx={{ width: 110 }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={presetValue}
          onChange={handlePresetChange}
          sx={{ flexGrow: 1 }}
        >
          {YAW_PRESETS_DEG.map((deg) => (
            <ToggleButton
              key={deg}
              value={deg}
              sx={{ textTransform: "none", flexGrow: 1, px: 0.5 }}
            >
              {`${deg}°`}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Button
        size="small"
        variant="outlined"
        fullWidth
        disabled={baseMapAngleDeg === null}
        onClick={handleAlignOnBaseMap}
        sx={{ textTransform: "none" }}
      >
        {baseMapAngleDeg === null ? alignS : `${alignS} (${baseMapAngleDeg}°)`}
      </Button>
    </Card>
  );
}
