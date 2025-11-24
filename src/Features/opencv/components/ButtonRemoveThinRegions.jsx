import { useState } from "react";
import { useDispatch } from "react-redux";

import { Box } from "@mui/material";

import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import cv from "../services/opencvService";
import editor from "App/editor";
import base64ToBlob from "Features/images/utils/base64ToBlob";

import { setOpencvPreviewUrl } from "../opencvSlice";

export default function ButtonRemoveThinRegions() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const baseMap = useMainBaseMap();

  const baseMapImageUrl =
    baseMap?.showEnhanced && baseMap?.imageEnhanced
      ? baseMap.imageEnhanced.imageUrlClient ??
        baseMap.imageEnhanced.imageUrlRemote
      : baseMap?.image?.imageUrlClient ?? baseMap?.image?.imageUrlRemote;

  const label = "Supprimer les régions fines";

  async function handleClick() {
    if (!baseMapImageUrl) return;

    setLoading(true);
    try {
      const bbox = editor?.viewportInBase?.bounds;
      await cv.load();
      const { resultImageBase64 } = await cv.removeThinRegionsAsync({
        imageUrl: baseMapImageUrl,
        bbox,
      });

      if (resultImageBase64) {
        const blob = base64ToBlob(resultImageBase64, "image/png");
        if (blob) {
          const url = URL.createObjectURL(blob);
          dispatch(setOpencvPreviewUrl(url));
        }
      }
    } catch (error) {
      console.error("Failed to remove thin regions:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ButtonActionInPanel
        label={label}
        onClick={handleClick}
        loading={loading}
        variant="contained"
        color="action"
      ></ButtonActionInPanel>
    </Box>
  );
}

