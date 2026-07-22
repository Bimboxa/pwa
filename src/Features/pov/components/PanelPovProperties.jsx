import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  clearSelection,
  selectSelectedItem,
} from "Features/selection/selectionSlice";

import {
  Box,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBack as Back, PhotoCamera } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SectionCaptureExport from "Features/mapEditor/components/SectionCaptureExport";
import IconButtonMoreActionsPov from "./IconButtonMoreActionsPov";
import PanelPovFilters from "./PanelPovFilters";
import PanelPovFrameProperties from "./PanelPovFrameProperties";
import SectionPovCadrage from "./SectionPovCadrage";

import captureMapAsPng from "Features/mapEditor/utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import exportPovImageService from "../services/exportPovImageService";

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

  // The saved AI-transformed image (when the user kept one) wins over the
  // capture thumbnail — for the preview and for the download. Downloading
  // never re-launches a generation: it exports the stored file as-is.
  const transformedFileName = pov?.transformedImage?.fileName ?? null;
  const displayedFileName = transformedFileName ?? pov?.image?.fileName;
  const imageUrl = usePovImageUrl(displayedFileName);
  const updatePov = useUpdatePov();

  const viewerMode = useSelector((s) => s.pov.viewerMode);
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const roundedBorderMask = useSelector((s) => s.mapEditor.imageModeBorder);
  const panelOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const rightInset = panelOpen ? panelWidth : 0;

  // state

  const [tab, setTab] = useState("IMAGE");
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

  // Export: the saved AI-transformed image when the toggle shows it, else a
  // fresh capture of the currently displayed framed view (the click on the
  // POV item restored it), at full resolution.
  async function handleExport({ mode, fileName, pixelRatio, whiteBackground }) {
    if (transformedFileName) {
      const exported = await exportPovImageService({
        storedFileName: transformedFileName,
        mode,
        fileName,
        aspectRatio: pov.aspectRatio ?? aspectRatio,
      });
      if (exported) return;
      // stored file missing → fall through to a fresh capture
    }
    const isThreed = viewerMode === "THREED";
    await captureMapAsPng({
      viewerKey: isThreed ? "THREED" : "MAP",
      target: mode === "clipboard" ? "clipboard" : "download",
      format: mode === "clipboard" ? undefined : mode,
      fileName,
      aspectRatio,
      pixelRatio,
      whiteBackground,
      roundedBorderMask,
      rightInset,
      prepareHost: isThreed ? snapshotThreedCanvasForCapture : undefined,
    });
  }

  // render

  // No resolved POV (nothing selected, record deleted, or list still
  // loading): always fall back to the "Nouveau point de vue" panel.
  if (!pov) return <PanelPovFrameProperties />;

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

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tab label="Image" value="IMAGE" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Cadrage" value="CADRAGE" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Filtres" value="FILTRES" sx={{ minHeight: 36, py: 0.5 }} />
      </Tabs>

      {tab === "FILTRES" && <PanelPovFilters />}

      {tab === "IMAGE" && (
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

          {/* Download (resolution options live in the Cadrage tab) */}
          <WhiteSectionGeneric>
            <SectionCaptureExport
              onExport={handleExport}
              defaultFilename="point_de_vue"
              showOptions={false}
            />
          </WhiteSectionGeneric>
        </Box>
      )}

      {/* Frame + legend settings (shared imageMode state): tweak them, then
          "Mettre à jour la vue" persists them into this POV. */}
      {tab === "CADRAGE" && <SectionPovCadrage />}
    </BoxFlexVStretch>
  );
}
