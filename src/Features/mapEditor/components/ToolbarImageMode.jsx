// Top-right toolbar driving the "Mode image" capture flow in MAP viewer.
//
// Off → screenshot icon disabled, the popper map listings remain.
// On  → screenshot active (writes the cropped PNG to clipboard);
//       overlay + dim mask appear in the viewport. Below the toolbar:
//       aspect-ratio selector, font size selector, show-quantities,
//       and download.

import { useSelector, useDispatch } from "react-redux";

import {
  setImageModeEnabled,
  setImageModeAspectRatio,
  setImageModeLegendOverlay,
} from "../mapEditorSlice";

import captureMapAsPng from "../utils/captureMapAsPng";

import {
  Box,
  Paper,
  Stack,
  Switch,
  Typography,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from "@mui/material";
import {
  PhotoCamera,
  Download,
  FormatSize,
  CropLandscape,
  CropSquare,
  CropPortrait,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";

export default function ToolbarImageMode({ viewerKey = "MAP" }) {
  const dispatch = useDispatch();

  // data

  const imageModeEnabled = useSelector(
    (s) => s.mapEditor.imageModeEnabled
  );
  const aspectRatio = useSelector(
    (s) => s.mapEditor.imageModeAspectRatio
  );
  const overlay = useSelector(
    (s) => s.mapEditor.imageModeLegendOverlay
  );
  const showQty = overlay?.showQty ?? true;
  const fontSize = overlay?.fontSize || 12;

  // handlers

  function handleToggleMode(_, checked) {
    dispatch(setImageModeEnabled(Boolean(checked)));
  }

  async function handleClipboardCapture() {
    if (!imageModeEnabled) return;
    try {
      await captureMapAsPng({
        viewerKey,
        target: "clipboard",
        aspectRatio,
      });
    } catch (err) {
      console.error("[ToolbarImageMode] clipboard capture failed", err);
    }
  }

  async function handleDownloadCapture() {
    try {
      await captureMapAsPng({
        viewerKey,
        target: "download",
        fileName: "map.png",
        aspectRatio,
      });
    } catch (err) {
      console.error("[ToolbarImageMode] download capture failed", err);
    }
  }

  function handleAspectRatioChange(_, value) {
    if (!value) return;
    dispatch(setImageModeAspectRatio(value));
  }

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

  // render

  return (
    <Box
      data-capture-hide
      sx={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 11,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 1,
        pointerEvents: "none",
      }}
    >
      <Paper elevation={3} sx={{ p: 0.5, pointerEvents: "auto" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ pl: 1 }}>
          <Switch
            size="small"
            checked={imageModeEnabled}
            onChange={handleToggleMode}
          />
          <Typography variant="body2" sx={{ userSelect: "none" }}>
            Mode image
          </Typography>
          <Tooltip title="Copier la capture dans le presse-papiers">
            <span>
              <IconButton
                size="small"
                color="primary"
                onClick={handleClipboardCapture}
                disabled={!imageModeEnabled}
                aria-label="Capture d'écran"
              >
                <PhotoCamera fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      {imageModeEnabled && (
        <Paper
          elevation={3}
          sx={{
            p: 1,
            width: 240,
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <WhiteSectionGeneric>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 0.5 }}
            >
              Format
            </Typography>
            <ToggleButtonGroup
              value={aspectRatio}
              exclusive
              onChange={handleAspectRatioChange}
              size="small"
              fullWidth
            >
              <ToggleButton value="LANDSCAPE">
                <CropLandscape sx={{ fontSize: 20 }} />
              </ToggleButton>
              <ToggleButton value="SQUARE">
                <CropSquare sx={{ fontSize: 20 }} />
              </ToggleButton>
              <ToggleButton value="PORTRAIT">
                <CropPortrait sx={{ fontSize: 20 }} />
              </ToggleButton>
            </ToggleButtonGroup>
          </WhiteSectionGeneric>

          <WhiteSectionGeneric>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 0.5 }}
            >
              Taille
            </Typography>
            <ToggleButtonGroup
              value={String(fontSize)}
              exclusive
              onChange={handleFontSizeChange}
              size="small"
              fullWidth
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
          </WhiteSectionGeneric>

          <FieldCheck
            value={showQty}
            onChange={handleToggleShowQty}
            label="Afficher les quantités"
            options={{ type: "switch", showAsSection: true }}
          />

          <Button
            variant="outlined"
            size="small"
            startIcon={<Download />}
            onClick={handleDownloadCapture}
            fullWidth
          >
            Télécharger
          </Button>
        </Paper>
      )}
    </Box>
  );
}
