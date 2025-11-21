import { useEffect, useState } from "react";

import { Box } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";
import ImageGeneric from "Features/images/components/ImageGeneric";

import cv from "../services/opencvService";

export default function ButtonRemoveText() {
  // string

  const label = "Retirer le texte";
  const saveLabel = "Enregistrer";

  // state

  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [triggerOpenAt, setTriggerOpenAt] = useState(false);

  // data

  const baseMap = useMainBaseMap();
  const update = useUpdateBaseMapWithImageEnhanced();

  // helpers

  const baseMapImageUrl =
    baseMap?.showEnhanced && baseMap?.imageEnhanced
      ? baseMap.imageEnhanced.imageUrlClient ??
        baseMap.imageEnhanced.imageUrlRemote
      : baseMap?.image?.imageUrlClient ?? baseMap?.image?.imageUrlRemote;

  // handlers

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleClick() {
    if (!baseMapImageUrl || !baseMap?.id) return;

    setLoading(true);
    try {
      await cv.load();
      const { resultImageBase64 } = await cv.removeTextAsync({
        imageUrl: baseMapImageUrl,
      });

      if (resultImageBase64) {
        // Convert base64 to blob
        const binaryString = atob(resultImageBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const resultBlob = new Blob([bytes], { type: "image/png" });
        const objectUrl = URL.createObjectURL(resultBlob);

        setBlob(resultBlob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
        setTriggerOpenAt(Date.now());
      }
    } catch (error) {
      console.error("Failed to remove text:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!blob || !baseMap?.id) return;

    const file = new File([blob], "no-text.png");
    await update(baseMap.id, file);

    // Clear preview after saving
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setBlob(null);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ButtonActionInPanel
        label={label}
        onClick={handleClick}
        loading={loading}
        variant="contained"
        color="action"
        triggerOpenAt={triggerOpenAt}
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
            <Box sx={{ mt: 1 }}>
              <ButtonGeneric label={saveLabel} onClick={handleSave} />
            </Box>
          </Box>
        )}
      </ButtonActionInPanel>
    </Box>
  );
}
