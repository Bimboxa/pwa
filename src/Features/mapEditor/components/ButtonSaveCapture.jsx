import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setCaptureToolActive, setCaptureTitleText } from "../mapEditorSlice";
import { setPovAiEnhanceEnabled } from "Features/pov/povSlice";

import { selectCaptureHostViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AutoAwesome, Close, Edit, PhotoCamera } from "@mui/icons-material";

import PovAiEnhanceFrameOverlay from "Features/pov/components/PovAiEnhanceFrameOverlay";
import DialogPovEnhancePrompt from "Features/pov/components/DialogPovEnhancePrompt";
import usePovEnhancePrompt from "Features/pov/hooks/usePovEnhancePrompt";
import useCaptureFrameBounds from "Features/pov/hooks/useCaptureFrameBounds";

import captureMapAsPng, { getPdfPageSize } from "../utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import enhanceBaseMapService from "Features/baseMaps/services/enhanceBaseMapService";
import composeEnhancedPovImage from "Features/pov/utils/composeEnhancedPovImage";
import downloadBlob from "Features/files/utils/downloadBlob";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";

// Save bar of the global Capture tool (Alt+C), anchored below the capture
// frame — the ButtonSavePov counterpart, but with a downloaded PNG as the
// deliverable instead of a db.povs record: the capture title field (feeds
// the frame's title banner), the "Amélioration IA" checkbox (same prompt +
// endpoint as the POV flow) and the capture button. Positioned `fixed` from
// screenRect: unlike the POV module, the host's origin does not always
// coincide with SectionViewer's box (MESHES nests the editor).
export default function ButtonSaveCapture() {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer la capture";
  const aiEnhanceS = "IA";
  const aiEnhanceTooltipS = "Amélioration IA";
  const editPromptS = "Modifier le prompt d'amélioration IA";
  const titlePlaceholderS = "Titre de la capture";
  const closeS = "Quitter le mode capture";

  // data

  const captureTitleText = useSelector((s) => s.mapEditor.captureTitleText);
  // File name comes from the panel's "Nom du fichier" field, NOT the title
  // (the title only feeds the frame's banner).
  const captureFileName = useSelector((s) => s.mapEditor.captureFileName);

  const aiEnhanceEnabled = useSelector((s) => s.pov.aiEnhanceEnabled);
  const {
    prompt,
    promptText,
    isCustom: isCustomPrompt,
    serviceUrl,
    enabled: aiAvailable,
  } = usePovEnhancePrompt();

  const hostViewerKey = useSelector(selectCaptureHostViewerKey);
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );
  const roundedBorderMask = useSelector((s) => s.mapEditor.imageModeBorder);
  const highRes = useSelector((s) => s.mapEditor.imageModeHighRes);
  // Output format picked in the panel's Capture tab (SectionCaptureExport).
  const exportMode = useSelector((s) => s.mapEditor.imageModeExportMode);

  const frameBounds = useCaptureFrameBounds(hostViewerKey);

  // state

  const [busy, setBusy] = useState(false);
  // {originalUrl, enhancedUrl, enhancedBlob, loading, error} | null
  const [aiState, setAiState] = useState(null);
  const [openPrompt, setOpenPrompt] = useState(false);

  // helpers

  const isThreed = hostViewerKey === "THREED";
  const pixelRatio = highRes ? 4 : 2;
  const baseName = captureFileName?.trim() || "capture";

  // No measurable capture host (e.g. the PORTFOLIO module, where the tool is
  // hidden but its state may linger, or the first pre-measure render): no
  // frame on screen, so no bar either. All hooks run above this point.
  if (!frameBounds) return null;

  // helpers - bar position (viewport space, centered just below the frame)

  const { screenRect, hostBounds } = frameBounds;
  // ~48px tall bar + 8px of breathing room: kept inside the host when the
  // frame margin is too thin to host it entirely below the frame.
  const maxBarTop = hostBounds.top + hostBounds.height - 56;
  const barPositionSx = {
    left: screenRect.left + screenRect.width / 2,
    top: Math.min(screenRect.top + screenRect.height + 12, maxBarTop),
    transform: "translate(-50%, 0)",
  };

  // handlers

  // The full deliverable: decor included, rounded-border mask, high-res,
  // delivered in the format picked in the panel (pdf / png / clipboard).
  async function deliverCapture() {
    const common = {
      viewerKey: hostViewerKey,
      aspectRatio,
      pixelRatio,
      whiteBackground,
      roundedBorderMask,
      prepareHost: isThreed ? snapshotThreedCanvasForCapture : undefined,
    };
    if (exportMode === "clipboard") {
      // fileName = the download fallback when the Clipboard API is missing
      await captureMapAsPng({
        ...common,
        target: "clipboard",
        fileName: `${baseName}.png`,
      });
    } else {
      await captureMapAsPng({
        ...common,
        target: "download",
        format: exportMode, // "pdf" | "png"
        fileName: `${baseName}.${exportMode}`,
      });
    }
  }

  // Same format rule for an already-built blob (the AI-enhanced result).
  async function deliverBlob(blob) {
    if (exportMode === "clipboard") {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        return;
      }
      downloadBlob(blob, `${baseName}.png`);
    } else if (exportMode === "pdf") {
      const url = URL.createObjectURL(blob);
      try {
        const { pageWidth, pageHeight } = getPdfPageSize(aspectRatio);
        const pdfFile = await imageToPdfAsync({ url, pageWidth, pageHeight });
        downloadBlob(pdfFile, `${baseName}.pdf`);
      } finally {
        URL.revokeObjectURL(url);
      }
    } else {
      downloadBlob(blob, `${baseName}.png`);
    }
  }

  // The AI input is the framed view WITHOUT the decor (no border, no title,
  // no watermark/logo — background image + legend only), like the POV flow.
  async function captureAiInput() {
    return await captureMapAsPng({
      viewerKey: hostViewerKey,
      target: "blob",
      aspectRatio,
      pixelRatio: 2,
      whiteBackground,
      excludeDecor: true,
      prepareHost: isThreed ? snapshotThreedCanvasForCapture : undefined,
    });
  }

  function startAiEnhance(blob) {
    const originalUrl = URL.createObjectURL(blob);
    setAiState({ originalUrl, loading: true });

    enhanceBaseMapService({
      baseMapId: "capture_tool",
      transformId: prompt.id,
      file: new File([blob], "capture.png", { type: "image/png" }),
      prompt: promptText,
      serviceUrl,
      onSuccess: ({ blob: enhancedBlob, objectUrl: enhancedUrl }) => {
        setAiState((prev) =>
          prev ? { ...prev, enhancedBlob, enhancedUrl, loading: false } : prev
        );
      },
      onError: () => {
        setAiState((prev) =>
          prev ? { ...prev, loading: false, error: true } : prev
        );
      },
    });
  }

  function handleCloseAiOverlay() {
    if (aiState?.originalUrl) URL.revokeObjectURL(aiState.originalUrl);
    if (aiState?.enhancedUrl) URL.revokeObjectURL(aiState.enhancedUrl);
    setAiState(null);
  }

  // "Enregistrer l'image d'origine": a fresh full capture (the overlay's
  // original is the decor-less AI input, not the deliverable).
  async function handleSaveOriginal() {
    await deliverCapture();
    handleCloseAiOverlay();
  }

  async function handleSaveEnhanced(enhancedBlob) {
    // Decor overlay (border + title, when their options are on) captured
    // NOW, alone over transparency: the result overlay covers the frame so
    // the capture blink stays hidden, and the crop matches the decor's
    // current on-screen position.
    const decorBlob = await captureMapAsPng({
      viewerKey: hostViewerKey,
      target: "blob",
      aspectRatio,
      pixelRatio: 2,
      decorOnly: true,
    });

    const finalBlob = await composeEnhancedPovImage({
      enhancedBlob,
      decorBlob,
      roundedBorderMask,
    });
    await deliverBlob(finalBlob);
    handleCloseAiOverlay();
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      if (aiEnhanceEnabled && aiAvailable) {
        const aiBlob = await captureAiInput();
        startAiEnhance(aiBlob);
      } else {
        await deliverCapture();
      }
    } finally {
      setBusy(false);
    }
  }

  function handleQuit() {
    // PanelCaptureTool's transition effect closes the panel if it is open
    // on the CAPTURE tool.
    dispatch(setCaptureToolActive(false));
  }

  // render

  return (
    <>
      {!aiState && (
        <Box
          sx={{
            position: "fixed",
            zIndex: 30,
            display: "flex",
            alignItems: "stretch",
            width: "max-content",
            bgcolor: "white",
            borderRadius: 2,
            boxShadow: 4,
            overflow: "hidden",
            ...barPositionSx,
          }}
        >
          {/* capture title: feeds the frame's title banner (usePovTitleText) */}
          <TextField
            variant="standard"
            placeholder={titlePlaceholderS}
            value={captureTitleText}
            onChange={(e) => dispatch(setCaptureTitleText(e.target.value))}
            slotProps={{ input: { disableUnderline: true } }}
            sx={{
              width: 200,
              px: 2,
              "& .MuiInputBase-root": { height: "100%" },
            }}
          />

          <Divider orientation="vertical" flexItem />

          {/* "Amélioration IA": toggle + prompt edition, in one pill with
              the capture button (same option state as the POV flow) */}
          {aiAvailable && (
            <>
              <Tooltip title={aiEnhanceTooltipS}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    pl: 0.5,
                    pr: 1.5,
                  }}
                >
                  <Checkbox
                    size="small"
                    color="secondary"
                    checked={aiEnhanceEnabled}
                    onChange={(e) =>
                      dispatch(setPovAiEnhanceEnabled(e.target.checked))
                    }
                  />
                  <AutoAwesome fontSize="small" color="secondary" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {aiEnhanceS}
                  </Typography>
                </Box>
              </Tooltip>

              {/* the prompt is only editable once the option is on */}
              {aiEnhanceEnabled && (
                <>
                  <Divider orientation="vertical" flexItem />

                  <Tooltip title={editPromptS}>
                    <Box
                      sx={{ display: "flex", alignItems: "center", px: 0.5 }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => setOpenPrompt(true)}
                      >
                        <Badge
                          color="secondary"
                          variant="dot"
                          invisible={!isCustomPrompt}
                        >
                          <Edit fontSize="small" />
                        </Badge>
                      </IconButton>
                    </Box>
                  </Tooltip>
                </>
              )}
            </>
          )}

          <Button
            variant="contained"
            color="secondary"
            startIcon={<PhotoCamera />}
            onClick={handleClick}
            disabled={busy}
            sx={{
              textTransform: "none",
              boxShadow: "none",
              // the pill's overflow:hidden rounds the outer corners
              borderRadius: 0,
              px: 2.5,
              // the label must stay on one line whatever the pill's width
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {createS}
          </Button>

          <Tooltip title={closeS}>
            <Box sx={{ display: "flex", alignItems: "center", px: 0.5 }}>
              <IconButton size="small" onClick={handleQuit}>
                <Close fontSize="small" />
              </IconButton>
            </Box>
          </Tooltip>
        </Box>
      )}

      {aiState && (
        <PovAiEnhanceFrameOverlay
          state={aiState}
          viewerKey={hostViewerKey}
          onClose={handleCloseAiOverlay}
          onSaveOriginal={handleSaveOriginal}
          onSaveEnhanced={handleSaveEnhanced}
        />
      )}

      <DialogPovEnhancePrompt
        open={openPrompt}
        onClose={() => setOpenPrompt(false)}
      />
    </>
  );
}
