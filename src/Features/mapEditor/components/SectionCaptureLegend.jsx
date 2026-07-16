import { useSelector, useDispatch } from "react-redux";

import { setImageModeLegendOverlay } from "../mapEditorSlice";

import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
} from "@mui/material";
import { FormatSize, Visibility, VisibilityOff } from "@mui/icons-material";

import FieldCheck from "Features/form/components/FieldCheck";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

// Capture legend controls (visibility / font size / quantities), driving the
// shared imageModeLegendOverlay state read by ImageModeOverlay. Used by
// PanelCaptureMode ("Export rapide") and by the POV frame properties panel.
export default function SectionCaptureLegend() {
  const dispatch = useDispatch();

  // data

  const overlay = useSelector((s) => s.mapEditor.imageModeLegendOverlay);

  // helpers

  const showQty = overlay?.showQty ?? true;
  const legendVisible = overlay?.visible ?? true;
  const fontSize = overlay?.fontSize || 12;

  // handlers

  function handleFontSizeChange(_, value) {
    if (!value) return;
    dispatch(
      setImageModeLegendOverlay({ ...overlay, fontSize: Number(value) })
    );
  }

  function handleToggleShowQty(checked) {
    dispatch(
      setImageModeLegendOverlay({ ...overlay, showQty: Boolean(checked) })
    );
  }

  function handleToggleLegendVisible() {
    dispatch(
      setImageModeLegendOverlay({ ...overlay, visible: !legendVisible })
    );
  }

  // render

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="overline" sx={LABEL_SX}>
          Légende
        </Typography>
        <IconButton
          size="small"
          onClick={handleToggleLegendVisible}
          title={legendVisible ? "Masquer la légende" : "Afficher la légende"}
        >
          {legendVisible ? (
            <Visibility fontSize="small" />
          ) : (
            <VisibilityOff fontSize="small" />
          )}
        </IconButton>
      </Box>

      {legendVisible && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 0.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Taille
            </Typography>
            <ToggleButtonGroup
              value={String(fontSize)}
              exclusive
              onChange={handleFontSizeChange}
              size="small"
            >
              <ToggleButton value="10">
                <FormatSize sx={{ fontSize: 14 }} />
              </ToggleButton>
              <ToggleButton value="12">
                <FormatSize sx={{ fontSize: 18 }} />
              </ToggleButton>
              <ToggleButton value="14">
                <FormatSize sx={{ fontSize: 22 }} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <FieldCheck
            value={showQty}
            onChange={handleToggleShowQty}
            label="Afficher les quantités"
            options={{ type: "switch", showAsInline: true }}
          />
        </Box>
      )}
    </Box>
  );
}
