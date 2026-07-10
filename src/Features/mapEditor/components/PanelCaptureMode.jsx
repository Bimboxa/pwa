// Capture-mode controls, rendered inside the "Export rapide" white section of
// PanelPrint. Three sub-sections: Format (aspect ratio), Légende, Export.
// No own white card / scroll container — it lives inside the parent section.

import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  setImageModeAspectRatio,
  setImageModeLegendOverlay,
  setImageModeHighRes,
  setImageModeWhiteBackground,
} from "../mapEditorSlice";

import captureMapAsPng from "../utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";

import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Divider,
} from "@mui/material";
import {
  FormatSize,
  CropLandscape,
  CropSquare,
  CropPortrait,
  PictureAsPdf,
  Image as ImageIcon,
  ContentCopy,
  Download,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import FieldCheck from "Features/form/components/FieldCheck";

// Export modes (output format selector). Label + extension are driven by the
// selected mode.
const EXPORT_MODES = {
  pdf: { label: "Télécharger en PDF", ext: ".pdf" },
  png: { label: "Télécharger en PNG", ext: ".png" },
  clipboard: { label: "Copier dans le presse-papier", ext: "" },
};

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

const SEG_SX = {
  flexDirection: "column",
  gap: 0.25,
  py: 0.5,
  textTransform: "none",
  fontSize: 11,
};

export default function PanelCaptureMode({ viewerKey = "MAP" }) {
  const dispatch = useDispatch();

  // data

  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const overlay = useSelector((s) => s.mapEditor.imageModeLegendOverlay);
  const highRes = useSelector((s) => s.mapEditor.imageModeHighRes);
  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );
  // Right panel occludes the viewport's right side; mirror the overlay so the
  // exported crop matches the displayed capture rect.
  const panelOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const rightInset = panelOpen ? panelWidth : 0;
  const showQty = overlay?.showQty ?? true;
  const legendVisible = overlay?.visible ?? true;
  const fontSize = overlay?.fontSize || 12;

  // state

  const [filename, setFilename] = useState("capture");
  const [mode, setMode] = useState("pdf"); // "pdf" | "png" | "clipboard"

  const modeCfg = EXPORT_MODES[mode];

  // High def doubles the html-to-image pixelRatio (default 2 → 4).
  const pixelRatio = highRes ? 4 : 2;

  // handlers

  async function handlePrimaryExport() {
    const baseName = (filename || "").trim() || "capture";
    // The 3D WebGL canvas can't be cloned by html-to-image (no
    // preserveDrawingBuffer) — snapshot it into a capturable img first.
    const prepareHost =
      viewerKey === "THREED" ? snapshotThreedCanvasForCapture : undefined;
    try {
      if (mode === "clipboard") {
        await captureMapAsPng({
          viewerKey,
          target: "clipboard",
          aspectRatio,
          pixelRatio,
          whiteBackground,
          rightInset,
          prepareHost,
        });
      } else {
        await captureMapAsPng({
          viewerKey,
          target: "download",
          format: mode, // "pdf" | "png"
          fileName: baseName + modeCfg.ext,
          aspectRatio,
          pixelRatio,
          whiteBackground,
          rightInset,
          prepareHost,
        });
      }
    } catch (err) {
      console.error("[PanelCaptureMode] export failed", err);
    }
  }

  function handleAspectRatioChange(_, value) {
    if (!value) return;
    dispatch(setImageModeAspectRatio(value));
  }

  function handleModeChange(_, value) {
    if (!value) return;
    setMode(value);
  }

  function handleFontSizeChange(_, value) {
    if (!value) return;
    dispatch(
      setImageModeLegendOverlay({ ...overlay, fontSize: Number(value) })
    );
  }

  function handleToggleHighRes(checked) {
    dispatch(setImageModeHighRes(Boolean(checked)));
  }

  function handleToggleWhiteBackground(checked) {
    dispatch(setImageModeWhiteBackground(Boolean(checked)));
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
      <Divider />

      {/* FORMAT — label + toggle on one line */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="overline" sx={LABEL_SX}>
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

      {/* LÉGENDE — title + show/hide toggle on one line */}
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
            {/* Taille — label + toggle on one line */}
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

      {/* EXPORT */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="overline" sx={LABEL_SX}>
          Export
        </Typography>

        {/* Nom du fichier */}
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", px: 1, mb: 0.5 }}
          >
            Nom du fichier
          </Typography>
          <TextField
            size="small"
            fullWidth
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="capture"
            InputProps={{
              endAdornment: modeCfg.ext ? (
                <InputAdornment position="end">
                  <Typography variant="body2" color="text.secondary">
                    {modeCfg.ext}
                  </Typography>
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>

        {/* Sélecteur de format */}
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
          fullWidth
        >
          <ToggleButton value="pdf" sx={SEG_SX}>
            <PictureAsPdf sx={{ fontSize: 18 }} />
            PDF
          </ToggleButton>
          <ToggleButton value="png" sx={SEG_SX}>
            <ImageIcon sx={{ fontSize: 18 }} />
            PNG
          </ToggleButton>
          <ToggleButton value="clipboard" sx={SEG_SX}>
            <ContentCopy sx={{ fontSize: 18 }} />
            Copier
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Options */}
        <FieldCheck
          value={highRes}
          onChange={handleToggleHighRes}
          label="Haute définition"
          options={{ type: "switch", showAsInline: true }}
        />
        <FieldCheck
          value={whiteBackground}
          onChange={handleToggleWhiteBackground}
          label="Fond blanc"
          options={{ type: "switch", showAsInline: true }}
        />

        {/* Action principale */}
        <Button
          variant="contained"
          size="small"
          fullWidth
          startIcon={mode === "clipboard" ? <ContentCopy /> : <Download />}
          onClick={handlePrimaryExport}
          sx={{ textTransform: "none", mt: 0.5 }}
        >
          {modeCfg.label}
        </Button>
      </Box>
    </Box>
  );
}
