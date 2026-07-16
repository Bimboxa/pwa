import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  clearSelection,
  selectSelectedItem,
} from "Features/selection/selectionSlice";

import { Box, IconButton, TextField, Typography } from "@mui/material";
import { ArrowBack as Back, PhotoCamera } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SectionCaptureExport from "Features/mapEditor/components/SectionCaptureExport";
import IconButtonMoreActionsPov from "./IconButtonMoreActionsPov";

import captureMapAsPng from "Features/mapEditor/utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";

import usePovs from "../hooks/usePovs";
import usePovImageUrl from "../hooks/usePovImageUrl";
import useUpdatePov from "../hooks/useUpdatePov";
import getPovCaption, { getPovModeLabel } from "../utils/getPovCaption";

// Properties panel for the selected POV: thumbnail, description (persisted on
// blur) and a download section (fresh full-resolution capture of the current
// framed view — no 200 KB compression; selecting the POV in the list already
// restored its view).
export default function PanelPovProperties() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Point de vue";
  const descriptionS = "Description";

  // data

  const selectedItem = useSelector(selectSelectedItem);
  const povs = usePovs() ?? [];
  const pov = povs.find((p) => p.id === selectedItem?.id) ?? null;

  const imageUrl = usePovImageUrl(pov?.image?.fileName);
  const updatePov = useUpdatePov();

  const viewerMode = useSelector((s) => s.pov.viewerMode);
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const panelOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const rightInset = panelOpen ? panelWidth : 0;

  // state

  const [description, setDescription] = useState(pov?.description ?? "");

  useEffect(() => {
    setDescription(pov?.description ?? "");
  }, [pov?.id]);

  // helpers

  const caption = getPovCaption(pov);

  // handlers

  function handleBack() {
    dispatch(clearSelection());
  }

  function handleDescriptionBlur() {
    if (!pov) return;
    if ((pov.description ?? "") === description) return;
    updatePov(pov.id, { description });
  }

  // Fresh capture of the currently displayed framed view (the click on the
  // POV item restored it), at full resolution.
  async function handleExport({ mode, fileName, pixelRatio, whiteBackground }) {
    const isThreed = viewerMode === "THREED";
    await captureMapAsPng({
      viewerKey: isThreed ? "THREED" : "MAP",
      target: mode === "clipboard" ? "clipboard" : "download",
      format: mode === "clipboard" ? undefined : mode,
      fileName,
      aspectRatio,
      pixelRatio,
      whiteBackground,
      rightInset,
      prepareHost: isThreed ? snapshotThreedCanvasForCapture : undefined,
    });
  }

  // render

  if (!pov) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucun point de vue sélectionné
        </Typography>
      </Box>
    );
  }

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton onClick={handleBack}>
            <Back />
          </IconButton>
          <PhotoCamera
            fontSize="small"
            sx={{ mx: 1, color: "text.secondary" }}
          />
          <Box>
            <Typography variant="caption" color="text.secondary">
              {captionS}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {getPovModeLabel(pov)}
              {caption ? ` · ${caption}` : ""}
            </Typography>
          </Box>
        </Box>

        <IconButtonMoreActionsPov pov={pov} />
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          p: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {/* Image */}
        <Box
          sx={{
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {imageUrl && (
            <Box
              component="img"
              src={imageUrl}
              alt=""
              sx={{ width: 1, objectFit: "contain" }}
            />
          )}
        </Box>

        {/* Description */}
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          label={descriptionS}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
        />

        {/* Download */}
        <WhiteSectionGeneric>
          <SectionCaptureExport
            onExport={handleExport}
            defaultFilename="point_de_vue"
          />
        </WhiteSectionGeneric>
      </Box>
    </BoxFlexVStretch>
  );
}
