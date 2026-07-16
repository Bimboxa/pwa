import { useSelector, useDispatch } from "react-redux";

import { setImageModeAspectRatio } from "../mapEditorSlice";

import { Box, Typography, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { CropLandscape, CropSquare, CropPortrait } from "@mui/icons-material";

// Capture frame aspect ratio selector (shared imageMode state, read by
// ImageModeOverlay in both 2D and 3D). Used by PanelCaptureMode ("Export
// rapide") and by the POV frame properties panel. Rendered as an option row
// (same style as the legend's "Taille"), not as a section title.
export default function SectionCaptureFormat() {
  const dispatch = useDispatch();

  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);

  function handleAspectRatioChange(_, value) {
    if (!value) return;
    dispatch(setImageModeAspectRatio(value));
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Format
      </Typography>
      <ToggleButtonGroup
        value={aspectRatio}
        exclusive
        onChange={handleAspectRatioChange}
        size="small"
      >
        <ToggleButton value="LANDSCAPE">
          <CropLandscape sx={{ fontSize: 18 }} />
        </ToggleButton>
        <ToggleButton value="SQUARE">
          <CropSquare sx={{ fontSize: 18 }} />
        </ToggleButton>
        <ToggleButton value="PORTRAIT">
          <CropPortrait sx={{ fontSize: 18 }} />
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
