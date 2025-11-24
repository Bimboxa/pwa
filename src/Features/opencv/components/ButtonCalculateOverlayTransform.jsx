import { useEffect, useState, useMemo } from "react";

import { Box } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import { useSelector } from "react-redux";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";
import ImageGeneric from "Features/images/components/ImageGeneric";

import cv from "../services/opencvService";

export default function ButtonCalculateOverlayTransform() {
  // string
  const label = "Calculer transformation";
  const saveLabel = "Enregistrer";

  // state
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null); // Store blob for saving
  const [transformData, setTransformData] = useState(null);
  const [triggerOpenAt, setTriggerOpenAt] = useState(false);

  // data
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: baseMaps } = useBaseMaps({ filterByProjectId: projectId });
  const mainBaseMap = useMainBaseMap();
  const update = useUpdateEntity();

  // Find baseMap with name "Plan masse 00"
  const planMasseBaseMap = useMemo(() => {
    return baseMaps?.find((bm) => bm.name === "Plan masse 00");
  }, [baseMaps]);

  // helpers
  const mainImageUrl =
    planMasseBaseMap?.image?.imageUrlClient ??
    planMasseBaseMap?.image?.imageUrlRemote;

  const detailImageUrl =
    mainBaseMap?.showEnhanced && mainBaseMap?.imageEnhanced
      ? mainBaseMap.imageEnhanced.imageUrlClient ??
        mainBaseMap.imageEnhanced.imageUrlRemote
      : mainBaseMap?.image?.imageUrlClient ??
        mainBaseMap?.image?.imageUrlRemote;

  // handlers
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleClick() {
    if (!mainImageUrl || !detailImageUrl || !mainBaseMap?.id) return;

    setLoading(true);
    try {
      await cv.load();
      const result = await cv.calculateOverlayTransformAsync({
        mainImageUrl,
        detailImageUrl,
      });

      if (result?.overlayImageBase64) {
        // Convert base64 to blob
        const binaryString = atob(result.overlayImageBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const resultBlob = new Blob([bytes], { type: "image/png" });
        const objectUrl = URL.createObjectURL(resultBlob);

        setPreviewBlob(resultBlob); // Store blob for saving
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
        setTransformData(result.transform);
        setTriggerOpenAt(Date.now());
      }
    } catch (error) {
      console.error("Failed to calculate overlay transform:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (
      !transformData ||
      !mainBaseMap?.id ||
      !planMasseBaseMap?.id ||
      !planMasseBaseMap?.image?.meterByPx ||
      !previewBlob
    )
      return;

    // Convert blob to File
    const file = new File([previewBlob], "overlay.png", { type: "image/png" });

    // Update planMasseBaseMap with the preview image
    await update(planMasseBaseMap.id, { image: { file } });

    // Calculate new meterByPx based on transform scale
    // The transform scale tells us how much the detail image was scaled to match the main image
    // If scale = 2, the detail image was scaled up 2x, meaning it's actually 2x smaller in real-world scale
    // So: newMeterByPx = oldMeterByPx / scale
    // But we want to match the main image's scale, so we use the plan masse meterByPx
    const planMasseMeterByPx = planMasseBaseMap.image.meterByPx;
    const currentMeterByPx =
      mainBaseMap?.image?.meterByPx ?? planMasseMeterByPx;

    // The detail image was scaled by transformData.scale to match the main image
    // So the new meterByPx should be: planMasseMeterByPx / scale
    // This accounts for the scaling that was applied
    const newMeterByPx = planMasseMeterByPx / transformData.scale;

    await update(mainBaseMap.id, { meterByPx: newMeterByPx });

    // Clear preview after saving
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewBlob(null);
    setTransformData(null);
  }

  const canProcess = mainImageUrl && detailImageUrl && mainBaseMap?.id;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ButtonActionInPanel
        label={label}
        onClick={handleClick}
        loading={loading}
        variant="contained"
        color="action"
        triggerOpenAt={triggerOpenAt}
        disabled={!canProcess}
      >
        {previewUrl && (
          <Box sx={{ position: "relative" }}>
            <Box
              sx={{
                maxWidth: 280,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
              }}
            >
              <ImageGeneric url={previewUrl} />
            </Box>
            {transformData && (
              <Box
                sx={{ mt: 1, fontSize: "0.875rem", color: "text.secondary" }}
              >
                Translation: x={transformData.translation.x.toFixed(2)}, y=
                {transformData.translation.y.toFixed(2)}
              </Box>
            )}
            <Box sx={{ mt: 1 }}>
              <ButtonGeneric label={saveLabel} onClick={handleSave} />
            </Box>
          </Box>
        )}
      </ButtonActionInPanel>
    </Box>
  );
}
