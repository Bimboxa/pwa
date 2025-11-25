import { useState, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setOpencvPreviewUrl } from "../opencvSlice";
import { setOpencvClickMode } from "../opencvSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { Box } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";

import cv from "../services/opencvService";
import editor from "App/editor";
import base64ToBlob from "Features/images/utils/base64ToBlob";

export default function ButtonRemoveText() {
  const dispatch = useDispatch();

  // string

  const label = "Retirer le texte";

  // state

  const [loading, setLoading] = useState(false);

  // data

  const baseMap = useMainBaseMap();
  const opencvPreviewUrl = useSelector(
    (state) => state.opencv.opencvPreviewUrl
  );
  const enabledDrawingMode = useSelector(
    (state) => state.mapEditor.enabledDrawingMode
  );
  const opencvClickMode = useSelector((state) => state.opencv.opencvClickMode);

  // helpers

  const baseMapImageUrl =
    baseMap?.showEnhanced && baseMap?.imageEnhanced
      ? baseMap.imageEnhanced.imageUrlClient ??
        baseMap.imageEnhanced.imageUrlRemote
      : baseMap?.image?.imageUrlClient ?? baseMap?.image?.imageUrlRemote;

  // handlers

  async function handleClick() {
    if (!baseMapImageUrl || !baseMap?.id) return;

    dispatch(setEnabledDrawingMode("OPENCV"));
    dispatch(setOpencvClickMode("REMOVE_TEXT"));

    setLoading(true);
    // try {
    //   const bbox = editor?.viewportInBase?.bounds;

    //   await cv.load();
    //   const { resultImageBase64 } = await cv.removeTextAsync({
    //     imageUrl: opencvPreviewUrl ?? baseMapImageUrl,
    //     bbox,
    //   });

    //   if (resultImageBase64) {
    //     const blob = base64ToBlob(resultImageBase64, "image/png");
    //     if (blob) {
    //       const objectUrl = URL.createObjectURL(blob);
    //       dispatch(setOpencvPreviewUrl(objectUrl));
    //     }
    //   }
    // } catch (error) {
    //   console.error("Failed to remove text:", error);
    // } finally {
    //   setLoading(false);
    // }
  }

  useEffect(() => {
    if (enabledDrawingMode !== "OPENCV" || opencvClickMode !== "REMOVE_TEXT") {
      setLoading(false);
    }
  }, [enabledDrawingMode, opencvClickMode]);

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
