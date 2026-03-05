import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { clearOpencvPreviewUrl, setOpencvPreviewUrl } from "../opencvSlice";

import { Box } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";

import SectionColorPicker from "./SectionColorPicker";

import cv from "../services/opencvService";
import editor from "App/editor";
import base64ToBlob from "Features/images/utils/base64ToBlob";

export default function ButtonKeepColoredContent() {
  const dispatch = useDispatch();

  // strings

  const label = "Conserver les couleurs";

  // state

  const [loading, setLoading] = useState(false);

  const [triggerOpenAt, setTriggerOpenAt] = useState(false);

  // data

  const baseMap = useMainBaseMap();
  const selectedColors = useSelector(
    (state) => state.opencv.selectedColors ?? []
  );

  const baseMapImageUrl = baseMap?.getUrl();

  useEffect(() => {
    return () => {
      dispatch(clearOpencvPreviewUrl());
    };
  }, [dispatch]);

  async function handleClick() {
    if (!baseMapImageUrl || !baseMap?.id) return;
    if (!selectedColors?.length) {
      console.warn("No colors selected for keep-colored-content");
      return;
    }

    setLoading(true);
    try {
      const viewportBounds = editor?.viewportInBase?.bounds;
      const imageSize = baseMap?.getImageSize();

      const bbox =
        viewportBounds && viewportBounds.width > 0 && viewportBounds.height > 0
          ? viewportBounds
          : imageSize
            ? {
              x: 0,
              y: 0,
              width: imageSize.width,
              height: imageSize.height,
            }
            : undefined;

      const { resultImageBase64 } = await cv.keepColoredContentAsync({
        imageUrl: baseMapImageUrl,
        colors: selectedColors,
        bbox,
      });

      if (resultImageBase64) {
        const blob = base64ToBlob(resultImageBase64, "image/png");
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          dispatch(setOpencvPreviewUrl(objectUrl));
        }
      }
    } catch (error) {
      console.error("Failed to keep colored content:", error);
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || !selectedColors?.length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ButtonActionInPanel
        label={label}
        onClick={handleClick}
        loading={loading}
        disabled={isDisabled}
        variant="contained"
        color="action"
        triggerOpenAt={triggerOpenAt}
        helperText={
          !selectedColors?.length
            ? "Sélectionnez d'abord une couleur"
            : undefined
        }
      >
        <SectionColorPicker />
      </ButtonActionInPanel>
    </Box>
  );
}
