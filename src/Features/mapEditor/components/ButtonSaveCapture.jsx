import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setCaptureToolActive, setCaptureTitleText } from "../mapEditorSlice";
import {
  setPovAiEnhanceEnabled,
  setPovSharePreviewEnabled,
} from "Features/pov/povSlice";
import { setToaster } from "Features/layout/layoutSlice";

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
import {
  AutoAwesome,
  CenterFocusStrong,
  Close,
  CloudUpload,
  Edit,
  PhotoCamera,
} from "@mui/icons-material";

import PovAiEnhanceFrameOverlay from "Features/pov/components/PovAiEnhanceFrameOverlay";
import DialogPovEnhancePrompt from "Features/pov/components/DialogPovEnhancePrompt";
import usePovEnhancePrompt from "Features/pov/hooks/usePovEnhancePrompt";
import useCaptureFrameBounds from "Features/pov/hooks/useCaptureFrameBounds";
import usePovs from "Features/pov/hooks/usePovs";
import useCreatePov from "Features/pov/hooks/useCreatePov";
import useSavePovTransformedImage from "Features/pov/hooks/useSavePovTransformedImage";
import usePushPovPreview from "Features/pov/hooks/usePushPovPreview";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import useMainBaseMap from "../hooks/useMainBaseMap";
import useCaptureAspectRatio from "../hooks/useCaptureAspectRatio";
import { selectCaptureRightInset } from "../utils/captureRightInset";
import { getActiveMapEditor } from "../services/mapEditorRegistry";
import captureMapAsPng, { getPdfPageSize } from "../utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import fitThreedContentInCaptureRect from "Features/threedEditor/utils/fitThreedContentInCaptureRect";
import enhanceBaseMapService from "Features/baseMaps/services/enhanceBaseMapService";
import composeEnhancedPovImage from "Features/pov/utils/composeEnhancedPovImage";
import downloadBlob from "Features/files/utils/downloadBlob";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";

// Save bar of the global Capture tool (hotkey V), anchored below the capture
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
  const centerBaseMapS = "Centrer le fond de plan dans la capture";
  const centerThreedS = "Centrer les objets 3D dans la capture";
  const closeS = "Quitter le mode capture";
  const povSavedS = "Point de vue enregistré";
  const povFailedS = "Échec de l'enregistrement du point de vue";
  const sharePreviewTooltipS = "Partager la capture (aperçu envoyé au serveur)";
  const shareFailedS = "Échec du partage de l'aperçu";

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
  // Resolved value (preset key or the base map's numeric ratio) — must match
  // the frame drawn by ImageModeOverlay.
  const aspectRatio = useCaptureAspectRatio();
  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );
  const roundedBorderMask = useSelector((s) => s.mapEditor.imageModeBorder);
  const highRes = useSelector((s) => s.mapEditor.imageModeHighRes);
  // Output format picked in the panel's Capture tab (SectionCaptureExport).
  const storedExportMode = useSelector((s) => s.mapEditor.imageModeExportMode);
  // PDF page size (A4 / A3) — same on-screen frame, bigger pdf-lib page.
  const pageFormat = useSelector((s) => s.mapEditor.imageModePageFormat);
  // The capture drawer floats over the host's right side; every capture must
  // crop the same inset rect as the displayed frame (selectCaptureRightInset).
  const rightInset = useSelector(selectCaptureRightInset);

  const frameBounds = useCaptureFrameBounds(hostViewerKey);

  // "Center the baseMap in the frame" button (2D MAP host only).
  const baseMap = useMainBaseMap();
  const basePose = useSelector((s) => s.mapEditor.baseMapPoseInBg);

  // "pov" export mode: the capture is saved as a new point of view instead of
  // a file (list order comes from the existing POVs).
  const povs = usePovs();
  const createPov = useCreatePov();
  const savePovTransformedImage = useSavePovTransformedImage();

  // "share" option: every capture also creates a POV in the background and
  // pushes its preview to the backend (PovPreviews).
  const sharePreviewEnabled = useSelector((s) => s.pov.sharePreviewEnabled);
  const pushPovPreview = usePushPovPreview();
  const appConfig = useAppConfig();

  // state

  const [busy, setBusy] = useState(false);
  // {originalUrl, enhancedUrl, enhancedBlob, loading, error} | null
  const [aiState, setAiState] = useState(null);
  const [openPrompt, setOpenPrompt] = useState(false);

  // helpers

  const isThreed = hostViewerKey === "THREED";
  // 2D hosts backed by a MainMapEditorV3 instance: the "MAP" one (Dessin &
  // co) and the "BASE_MAPS" one (Fond de plan module). Both register their
  // camera handle as the active map editor, so the "center the base map"
  // button works the same on either.
  const is2dMapHost = hostViewerKey === "MAP" || hostViewerKey === "BASE_MAPS";
  const pixelRatio = highRes ? 4 : 2;
  const baseName = captureFileName?.trim() || "capture";

  // useCapturePovView only knows the MAP and THREED hosts, and the mode is
  // shared state that survives a viewer switch: fall back to a PDF elsewhere
  // rather than snapshotting a host that is not on screen.
  const povModeAvailable =
    hostViewerKey === "MAP" || hostViewerKey === "THREED";
  const exportMode =
    storedExportMode === "pov" && !povModeAvailable ? "pdf" : storedExportMode;

  // The share checkbox needs both a POV-capable host and the push endpoint
  // in the org config.
  const shareAvailable =
    povModeAvailable &&
    Boolean(appConfig?.features?.povPreviews?.push?.fetchParams);

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

  // "pov" mode: a new point of view holding the usual thumbnail plus the
  // full-resolution rawImage. The capture tool stays armed (no exit) and the
  // selection is left alone, so the panel keeps showing the capture band.
  async function createPovFromCapture() {
    return await createPov({
      lastSortIndex: povs?.at(-1)?.sortIndex ?? null,
      description: captureTitleText,
      viewerMode: isThreed ? "THREED" : "MAP",
      withRawImage: true,
      selectCreated: false,
    });
  }

  // "share" option, fire-and-forget: push the POV preview to the backend. In
  // "pov" export mode the POV already exists (existingPov); in the file modes
  // a thumbnail-only POV is created first (no rawImage: the push only sends
  // the thumbnail, and a 3rd html-to-image pass is not worth the flicker).
  function sharePovInBackground(existingPov) {
    if (!shareAvailable || !sharePreviewEnabled) return;
    if (exportMode === "pov" && !existingPov) return;
    (async () => {
      try {
        const pov =
          existingPov ??
          (await createPov({
            lastSortIndex: povs?.at(-1)?.sortIndex ?? null,
            description: captureTitleText,
            viewerMode: isThreed ? "THREED" : "MAP",
            withRawImage: false,
            selectCreated: false,
          }));
        if (!pov) return;
        await pushPovPreview(pov);
      } catch (e) {
        console.error("[ButtonSaveCapture] pov preview share failed", e);
        dispatch(setToaster({ message: shareFailedS, isError: true }));
      }
    })();
  }

  // The full deliverable: decor included, rounded-border mask, high-res,
  // delivered in the format picked in the panel (pdf / png / clipboard / pov).
  async function deliverCapture() {
    if (exportMode === "pov") {
      const pov = await createPovFromCapture();
      dispatch(
        setToaster(
          pov
            ? { message: povSavedS }
            : { message: povFailedS, severity: "warning" }
        )
      );
      sharePovInBackground(pov);
      return;
    }

    const common = {
      viewerKey: hostViewerKey,
      aspectRatio,
      pixelRatio,
      whiteBackground,
      roundedBorderMask,
      rightInset,
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
        pageFormat,
        fileName: `${baseName}.${exportMode}`,
      });
    }
    // after the deliverable capture, so the two passes never overlap
    sharePovInBackground();
  }

  // Same format rule for an already-built blob (the AI-enhanced result).
  async function deliverBlob(blob) {
    if (exportMode === "pov") {
      // The POV holds the raw capture (thumbnail + rawImage); the enhanced
      // composite goes in the existing `transformedImage` slot, which is what
      // the POV panel and the portfolio already prefer for display.
      const pov = await createPovFromCapture();
      if (!pov) {
        dispatch(setToaster({ message: povFailedS, severity: "warning" }));
        return;
      }
      await savePovTransformedImage(pov.id, blob);
      dispatch(setToaster({ message: povSavedS }));
      sharePovInBackground(pov);
      return;
    }
    sharePovInBackground();
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
        const { pageWidth, pageHeight } = getPdfPageSize(
          aspectRatio,
          pageFormat
        );
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
      rightInset,
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
      rightInset,
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

  // Fit the content inside the capture rect, centered. 2D: whole baseMap
  // image, same camera math as restorePovViewService.getCamera2dTarget but
  // fitting both dimensions (the image aspect ratio is arbitrary);
  // `frameBounds.rect` and the camera matrix share the same host-local
  // coordinate space. 3D: position-only camera move (orientation kept) that
  // maximizes the scene objects in the frame.
  function handleCenterContent() {
    if (isThreed) {
      fitThreedContentInCaptureRect(frameBounds);
      return;
    }
    const mapEditor = getActiveMapEditor();
    const imageSize = baseMap?.getImageSize?.();
    const { rect } = frameBounds;
    if (
      !mapEditor ||
      !imageSize?.width ||
      !imageSize?.height ||
      !basePose?.k ||
      !rect?.width
    )
      return;

    const k = Math.min(
      rect.width / (imageSize.width * basePose.k),
      rect.height / (imageSize.height * basePose.k)
    );
    const x =
      rect.left +
      rect.width / 2 -
      (basePose.x + (basePose.k * imageSize.width) / 2) * k;
    const y =
      rect.top +
      rect.height / 2 -
      (basePose.y + (basePose.k * imageSize.height) / 2) * k;
    mapEditor.setCameraMatrix?.({ x, y, k });
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
          {/* center the content in the capture frame (2D baseMap / 3D scene) */}
          {(is2dMapHost || isThreed) && (
            <>
              <Tooltip title={isThreed ? centerThreedS : centerBaseMapS}>
                <Box sx={{ display: "flex", alignItems: "center", px: 0.5 }}>
                  <IconButton size="small" onClick={handleCenterContent}>
                    <CenterFocusStrong fontSize="small" />
                  </IconButton>
                </Box>
              </Tooltip>

              <Divider orientation="vertical" flexItem />
            </>
          )}

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

          {/* "share" option: the capture also becomes a shared POV preview */}
          {shareAvailable && (
            <Tooltip title={sharePreviewTooltipS}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  pl: 0.5,
                  pr: 1,
                }}
              >
                <Checkbox
                  size="small"
                  color="secondary"
                  checked={sharePreviewEnabled}
                  onChange={(e) =>
                    dispatch(setPovSharePreviewEnabled(e.target.checked))
                  }
                />
                <CloudUpload fontSize="small" color="secondary" />
              </Box>
            </Tooltip>
          )}

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
