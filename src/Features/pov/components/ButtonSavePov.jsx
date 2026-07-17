import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setPovAiEnhanceEnabled } from "../povSlice";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
} from "@mui/material";
import { Add, Refresh } from "@mui/icons-material";

import PovAiEnhanceFrameOverlay from "./PovAiEnhanceFrameOverlay";
import usePovs from "../hooks/usePovs";
import useCreatePov from "../hooks/useCreatePov";
import useUpdatePovView from "../hooks/useUpdatePovView";
import usePovEnhancePrompt from "../hooks/usePovEnhancePrompt";
import useSavePovTransformedImage from "../hooks/useSavePovTransformedImage";
import useCaptureFrameBounds from "../hooks/useCaptureFrameBounds";

import captureMapAsPng from "Features/mapEditor/utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import enhanceBaseMapService from "Features/baseMaps/services/enhanceBaseMapService";
import composeEnhancedPovImage from "../utils/composeEnhancedPovImage";

// Appended to the org's usedByPov prompt: harmonize the legend with the
// drawing and hand-letter the texts like an architect on a hand-drawn plan.
const ENHANCE_PROMPT_SUFFIX =
  "\n\nKeep the EXACT camera viewpoint, framing and perspective of the " +
  "input image: do not zoom, crop, shift, tilt or rotate anything — every " +
  "wall, surface and object must stay at its exact position and size.\n" +
  "The legend box must be restyled too, never left as a digital UI " +
  "element: align its swatch colors with the exact colors used in the " +
  "drawing, and REDRAW every single text in it (title, labels, numbers and " +
  "units) by hand — do not keep any original typography, no clean " +
  "sans-serif or printed font may remain anywhere in the image. All " +
  "lettering must look hand-written with an ink pen by an architect on a " +
  "hand-drawn plan: one single consistent handwriting style, precise and " +
  "highly legible, in the spirit of the 'Architects Daughter' typeface, " +
  "with the slight irregularities of real handwriting.";

// Save bar anchored at the bottom-center of the capture frame, shown over
// both the 2D and 3D editors (replaces the 3D bottom toolbar): the
// "Amélioration IA" checkbox chip + the create/update button. Creates a new
// POV, or — when a POV is selected — updates it with the displayed view.
// With the checkbox on, both actions also send a full-res capture to the
// image-transformation endpoint and show the result in-frame
// (PovAiEnhanceFrameOverlay).
export default function ButtonSavePov() {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer une vue";
  const updateS = "Mettre à jour la vue";
  const aiEnhanceS = "Amélioration IA";

  // data

  const povs = usePovs() ?? [];
  const createPov = useCreatePov();
  const updatePovView = useUpdatePovView();
  const savePovTransformedImage = useSavePovTransformedImage();
  const selectedItem = useSelector(selectSelectedItem);

  const aiEnhanceEnabled = useSelector((s) => s.pov.aiEnhanceEnabled);
  const { prompt, serviceUrl, enabled: aiAvailable } = usePovEnhancePrompt();

  const viewerMode = useSelector((s) => s.pov.viewerMode);
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );
  const roundedBorderMask = useSelector((s) => s.mapEditor.imageModeBorder);
  const panelOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const rightInset = panelOpen ? panelWidth : 0;

  const frameBounds = useCaptureFrameBounds();

  // state

  const [busy, setBusy] = useState(false);
  // {povId, originalUrl, enhancedUrl, enhancedBlob, loading, error} | null
  const [aiState, setAiState] = useState(null);

  // helpers

  const selectedPov =
    selectedItem?.type === "POV"
      ? povs.find((p) => p.id === selectedItem.id)
      : null;

  // helpers - save bar position (bottom-center of the capture frame; falls
  // back to bottom-center of the viewer while the host is not measured yet)

  const rect = frameBounds?.rect;
  const barPositionSx = rect
    ? {
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height - 16,
        transform: "translate(-50%, -100%)",
      }
    : {
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
      };

  // handlers

  // The AI input is the framed view WITHOUT the decor (no border, no title,
  // no watermark/logo — background image + legend only). Captured BEFORE
  // createPov/updatePovView run their dispatches (opening the properties
  // panel can move the capture frame), so the AI input, the thumbnail and
  // the camera snapshot all share the exact same framing.
  async function captureAiInput() {
    const isThreed = viewerMode === "THREED";
    return await captureMapAsPng({
      viewerKey: isThreed ? "THREED" : "MAP",
      target: "blob",
      aspectRatio,
      pixelRatio: 2,
      whiteBackground,
      excludeDecor: true,
      rightInset,
      prepareHost: isThreed ? snapshotThreedCanvasForCapture : undefined,
    });
  }

  function startAiEnhance(povId, blob) {
    const originalUrl = URL.createObjectURL(blob);
    setAiState({ povId, originalUrl, loading: true });

    enhanceBaseMapService({
      baseMapId: `pov_${povId ?? "draft"}`,
      transformId: prompt.id,
      file: new File([blob], "pov.png", { type: "image/png" }),
      prompt: `${prompt.prompt}${ENHANCE_PROMPT_SUFFIX}`,
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

  // "Quitter" / "Enregistrer l'image d'origine": the original capture is
  // already the POV image (create/update ran first), just leave the flow.
  function handleCloseAiOverlay() {
    if (aiState?.originalUrl) URL.revokeObjectURL(aiState.originalUrl);
    if (aiState?.enhancedUrl) URL.revokeObjectURL(aiState.enhancedUrl);
    setAiState(null);
  }

  async function handleSaveEnhanced(enhancedBlob) {
    if (aiState?.povId) {
      // Decor overlay (border + title, when their options are on) captured
      // NOW, alone over transparency: the result overlay covers the frame so
      // the capture blink stays hidden, and the crop matches the decor's
      // current on-screen position.
      const decorBlob = await captureMapAsPng({
        viewerKey: viewerMode === "THREED" ? "THREED" : "MAP",
        target: "blob",
        aspectRatio,
        pixelRatio: 2,
        decorOnly: true,
        rightInset,
      });

      // Final image: the enhanced result kept at its native resolution (no
      // compression) with the decor overlay composited on top.
      const finalBlob = await composeEnhancedPovImage({
        enhancedBlob,
        decorBlob,
        roundedBorderMask,
      });
      await savePovTransformedImage(aiState.povId, finalBlob);
    }
    handleCloseAiOverlay();
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const aiOn = aiEnhanceEnabled && aiAvailable;
      if (selectedPov) {
        const aiBlob = aiOn ? await captureAiInput() : null;
        await updatePovView(selectedPov);
        if (aiBlob) startAiEnhance(selectedPov.id, aiBlob);
      } else {
        const aiBlob = aiOn ? await captureAiInput() : null;
        const record = await createPov({
          lastSortIndex: povs[povs.length - 1]?.sortIndex ?? null,
        });
        if (record && aiBlob) startAiEnhance(record.id, aiBlob);
      }
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <>
      {!aiState && (
        <Box
          sx={{
            position: "absolute",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            ...barPositionSx,
          }}
        >
          {/* "Amélioration IA" checkbox chip, in front of the button */}
          {aiAvailable && (
            <Box
              sx={{
                bgcolor: "white",
                borderRadius: 1,
                pl: 0.5,
                pr: 1.5,
                boxShadow: 4,
              }}
            >
              <FormControlLabel
                sx={{ m: 0 }}
                control={
                  <Checkbox
                    size="small"
                    color="secondary"
                    checked={aiEnhanceEnabled}
                    onChange={(e) =>
                      dispatch(setPovAiEnhanceEnabled(e.target.checked))
                    }
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {aiEnhanceS}
                  </Typography>
                }
              />
            </Box>
          )}

          <Button
            variant="contained"
            color="secondary"
            startIcon={selectedPov ? <Refresh /> : <Add />}
            onClick={handleClick}
            disabled={busy}
            sx={{ textTransform: "none", boxShadow: 4 }}
          >
            {selectedPov ? updateS : createS}
          </Button>
        </Box>
      )}

      {aiState && (
        <PovAiEnhanceFrameOverlay
          state={aiState}
          onClose={handleCloseAiOverlay}
          onSaveEnhanced={handleSaveEnhanced}
        />
      )}
    </>
  );
}
