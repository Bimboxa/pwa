import { useSelector, useDispatch } from "react-redux";

import {
  setImageModeAspectRatio,
  setImageModePageFormat,
} from "../mapEditorSlice";

import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  CropLandscape,
  CropSquare,
  CropPortrait,
  Wallpaper,
} from "@mui/icons-material";

// Capture frame aspect ratio selector (shared imageMode state, read by
// ImageModeOverlay in both 2D and 3D). Used by PanelCaptureMode ("Export
// rapide") and by the POV frame properties panel. Rendered as an option row
// (same style as the legend's "Taille"), not as a section title.
export default function SectionCaptureFormat() {
  const dispatch = useDispatch();

  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const pageFormat = useSelector((s) => s.mapEditor.imageModePageFormat);

  function handleAspectRatioChange(_, value) {
    if (!value) return;
    dispatch(setImageModeAspectRatio(value));
  }

  function handlePageFormatChange(_, value) {
    if (!value) return;
    dispatch(setImageModePageFormat(value));
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
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
          {/* frame locked on the active base map's image ratio */}
          <ToggleButton value="BASE_MAP" title="Fond de plan">
            <Wallpaper sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* PDF page size — A4 and A3 share the same √2 ratio, so the frame on
          screen does not change: only the exported PDF page grows. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Page PDF
        </Typography>
        <ToggleButtonGroup
          value={pageFormat}
          exclusive
          onChange={handlePageFormatChange}
          size="small"
        >
          <ToggleButton value="A4" sx={{ px: 1.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600 }}>A4</Typography>
          </ToggleButton>
          <ToggleButton value="A3" sx={{ px: 1.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600 }}>A3</Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
}
