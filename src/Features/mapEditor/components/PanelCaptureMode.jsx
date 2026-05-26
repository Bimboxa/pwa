// Body content of PopperMapListings when interactionMode === "CAPTURE".
// Three sections: Format, Légende, Export.

import { useSelector, useDispatch } from "react-redux";

import {
  setImageModeAspectRatio,
  setImageModeLegendOverlay,
  setImageModeHighRes,
  setImageModeWhiteBackground,
} from "../mapEditorSlice";

import captureMapAsPng from "../utils/captureMapAsPng";

import {
  Box,
  Typography,
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

import FieldCheck from "Features/form/components/FieldCheck";

function SectionTitle({ children }) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: "block",
        fontWeight: 600,
        color: "text.secondary",
        lineHeight: 1.2,
        mb: 1,
      }}
    >
      {children}
    </Typography>
  );
}

function SectionBlock({ children }) {
  return (
    <Box
      sx={{
        p: 1,
        bgcolor: "white",
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      {children}
    </Box>
  );
}

export default function PanelCaptureMode({ viewerKey = "MAP" }) {
  const dispatch = useDispatch();

  // data

  const aspectRatio = useSelector(
    (s) => s.mapEditor.imageModeAspectRatio
  );
  const overlay = useSelector(
    (s) => s.mapEditor.imageModeLegendOverlay
  );
  const highRes = useSelector((s) => s.mapEditor.imageModeHighRes);
  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );
  const showQty = overlay?.showQty ?? true;
  const legendVisible = overlay?.visible ?? true;
  const fontSize = overlay?.fontSize || 12;

  // High def doubles the html-to-image pixelRatio (default 2 → 4).
  const pixelRatio = highRes ? 4 : 2;

  // handlers

  async function handleClipboardCapture() {
    try {
      await captureMapAsPng({
        viewerKey,
        target: "clipboard",
        aspectRatio,
        pixelRatio,
        whiteBackground,
      });
    } catch (err) {
      console.error("[PanelCaptureMode] clipboard capture failed", err);
    }
  }

  async function handleDownloadCapture() {
    try {
      await captureMapAsPng({
        viewerKey,
        target: "download",
        fileName: "map.png",
        aspectRatio,
        pixelRatio,
        whiteBackground,
      });
    } catch (err) {
      console.error("[PanelCaptureMode] download capture failed", err);
    }
  }

  function handleToggleHighRes(checked) {
    dispatch(setImageModeHighRes(Boolean(checked)));
  }

  function handleToggleWhiteBackground(checked) {
    dispatch(setImageModeWhiteBackground(Boolean(checked)));
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

  function handleToggleLegendVisible(checked) {
    dispatch(
      setImageModeLegendOverlay({ ...overlay, visible: Boolean(checked) })
    );
  }

  // render

  return (
    <Box
      sx={{
        p: 1,
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
      }}
    >
      {/* FORMAT */}
      <Box>
        <SectionTitle>Format</SectionTitle>
        <SectionBlock>
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
        </SectionBlock>
      </Box>

      {/* LÉGENDE */}
      <Box>
        <SectionTitle>Légende</SectionTitle>
        <SectionBlock>
          <FieldCheck
            value={legendVisible}
            onChange={handleToggleLegendVisible}
            label="Afficher la légende"
            options={{ type: "switch", showAsInline: true }}
          />

          {legendVisible && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: -0.5 }}
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

              <FieldCheck
                value={showQty}
                onChange={handleToggleShowQty}
                label="Afficher les quantités"
                options={{ type: "switch", showAsInline: true }}
              />
            </>
          )}
        </SectionBlock>
      </Box>

      {/* EXPORT */}
      <Box>
        <SectionTitle>Export</SectionTitle>
        <SectionBlock>
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

          <Button
            variant="contained"
            size="small"
            startIcon={<PhotoCamera />}
            onClick={handleClipboardCapture}
            fullWidth
          >
            Copier la capture
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<Download />}
            onClick={handleDownloadCapture}
            fullWidth
          >
            Télécharger
          </Button>
        </SectionBlock>
      </Box>
    </Box>
  );
}
