import { useState } from "react";
import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import { Button } from "@mui/material";
import { Add, Refresh } from "@mui/icons-material";

import DialogPovAiEnhance from "./DialogPovAiEnhance";
import usePovs from "../hooks/usePovs";
import useCreatePov from "../hooks/useCreatePov";
import useUpdatePovView from "../hooks/useUpdatePovView";
import usePovEnhancePrompt from "../hooks/usePovEnhancePrompt";

import captureMapAsPng from "Features/mapEditor/utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import enhanceBaseMapService from "Features/baseMaps/services/enhanceBaseMapService";

// Floating button at the bottom of the POV viewer, shown over both the 2D
// and 3D editors (replaces the 3D bottom toolbar). Creates a new POV, or —
// when a POV is selected — updates it with the displayed view. With the
// "Amélioration IA" option on, both actions also send a full-res capture to
// the image-transformation endpoint and show the result in a comparison
// dialog.
export default function ButtonSavePov() {
  // strings

  const createS = "Créer une vue";
  const updateS = "Mettre à jour la vue";

  // data

  const povs = usePovs() ?? [];
  const createPov = useCreatePov();
  const updatePovView = useUpdatePovView();
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

  // state

  const [busy, setBusy] = useState(false);
  // {originalUrl, enhancedUrl, enhancedBlob, loading, error} | null
  const [aiState, setAiState] = useState(null);

  // helpers

  const selectedPov =
    selectedItem?.type === "POV"
      ? povs.find((p) => p.id === selectedItem.id)
      : null;

  // handlers

  async function runAiEnhance(povId) {
    // Full-res capture of the framed view, sent to the same endpoint as the
    // baseMap "Transformation IA".
    const isThreed = viewerMode === "THREED";
    const blob = await captureMapAsPng({
      viewerKey: isThreed ? "THREED" : "MAP",
      target: "blob",
      aspectRatio,
      pixelRatio: 2,
      whiteBackground,
      roundedBorderMask,
      rightInset,
      prepareHost: isThreed ? snapshotThreedCanvasForCapture : undefined,
    });
    if (!blob) return;

    const originalUrl = URL.createObjectURL(blob);
    setAiState({ originalUrl, loading: true });

    enhanceBaseMapService({
      baseMapId: `pov_${povId ?? "draft"}`,
      transformId: prompt.id,
      file: new File([blob], "pov.png", { type: "image/png" }),
      prompt: prompt.prompt,
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

  function handleCloseAiDialog() {
    if (aiState?.originalUrl) URL.revokeObjectURL(aiState.originalUrl);
    if (aiState?.enhancedUrl) URL.revokeObjectURL(aiState.enhancedUrl);
    setAiState(null);
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      if (selectedPov) {
        await updatePovView(selectedPov);
        if (aiEnhanceEnabled && aiAvailable) {
          await runAiEnhance(selectedPov.id);
        }
      } else {
        const record = await createPov({
          lastSortIndex: povs[povs.length - 1]?.sortIndex ?? null,
        });
        if (record && aiEnhanceEnabled && aiAvailable) {
          await runAiEnhance(record.id);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <>
      <Button
        variant="contained"
        color="secondary"
        startIcon={selectedPov ? <Refresh /> : <Add />}
        onClick={handleClick}
        disabled={busy}
        sx={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          textTransform: "none",
          boxShadow: 4,
        }}
      >
        {selectedPov ? updateS : createS}
      </Button>

      {aiState && (
        <DialogPovAiEnhance state={aiState} onClose={handleCloseAiDialog} />
      )}
    </>
  );
}
