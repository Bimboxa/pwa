import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  clearSelection,
  selectSelectedItem,
} from "Features/selection/selectionSlice";

import { Box, Button, IconButton, TextField, Typography } from "@mui/material";
import {
  ArrowBack as Back,
  Delete as DeleteIcon,
  PhotoCamera,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCaptureExport from "Features/mapEditor/components/SectionCaptureExport";

import captureMapAsPng from "Features/mapEditor/utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";

import usePovs from "../hooks/usePovs";
import usePovImageUrl from "../hooks/usePovImageUrl";
import useUpdatePov from "../hooks/useUpdatePov";
import useDeletePov from "../hooks/useDeletePov";

// Properties panel for the selected POV: thumbnail, description (persisted on
// blur) and a download section (fresh full-resolution capture of the current
// framed view — no 200 KB compression; selecting the POV in the list already
// restored its view).
export default function PanelPovProperties() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Point de vue";
  const descriptionS = "Description";
  const deleteS = "Supprimer";

  // data

  const selectedItem = useSelector(selectSelectedItem);
  const povs = usePovs() ?? [];
  const pov = povs.find((p) => p.id === selectedItem?.id) ?? null;

  const imageUrl = usePovImageUrl(pov?.image?.fileName);
  const updatePov = useUpdatePov();
  const deletePov = useDeletePov();

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

  const createdDate = pov?.createdAt
    ? new Date(pov.createdAt).toLocaleDateString("fr-FR")
    : null;
  const caption = [pov?.createdBy?.trigram, createdDate]
    .filter(Boolean)
    .join(" — ");

  // handlers

  function handleBack() {
    dispatch(clearSelection());
  }

  function handleDescriptionBlur() {
    if (!pov) return;
    if ((pov.description ?? "") === description) return;
    updatePov(pov.id, { description });
  }

  async function handleDeleteClick() {
    if (!pov) return;
    await deletePov(pov.id);
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
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <PhotoCamera fontSize="small" sx={{ mx: 1, color: "text.secondary" }} />
        <Box>
          <Typography variant="caption" color="text.secondary">
            {captionS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {pov.viewerMode === "THREED" ? "3D" : "2D"}
            {caption ? ` · ${caption}` : ""}
          </Typography>
        </Box>
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
        <SectionCaptureExport
          onExport={handleExport}
          defaultFilename="point_de_vue"
        />

        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleDeleteClick}
          sx={{ textTransform: "none", alignSelf: "flex-start" }}
        >
          {deleteS}
        </Button>
      </Box>
    </BoxFlexVStretch>
  );
}
