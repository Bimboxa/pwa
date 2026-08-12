import { useEffect, useMemo, useState } from "react";

import {
  Box,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { ArrowBack, Delete, Download, MoreHoriz } from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ContainerFilesSelectorV2 from "Features/files/components/ContainerFilesSelectorV2";
import ViewerPdf from "Features/pdf/components/ViewerPdf";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

import useResourceFile from "../hooks/useResourceFile";
import useDeleteResource from "../hooks/useDeleteResource";
import useReattachResourceFile from "../hooks/useReattachResourceFile";

export default function PanelResourceDetail({ resource, onBack }) {
  // strings

  const deleteS = "Supprimer";
  const downloadS = "Télécharger";
  const missingS =
    "Le fichier n'est pas disponible sur cet appareil (il n'est pas embarqué dans l'enregistrement du scope).";
  const reattachS = "Recharger le fichier en local";
  const noPreviewS = "Aperçu non disponible pour ce type de fichier.";

  // data

  const { file, loading, fileIsMissing } = useResourceFile(resource);
  const deleteResource = useDeleteResource();
  const reattachResourceFile = useReattachResourceFile();

  // state

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [reattaching, setReattaching] = useState(false);

  // helpers

  const isPdf = resource.fileType === "PDF";
  const isImage = resource.fileType === "IMAGE";
  const trigram = resource.createdBy?.trigram;
  const infoS = [stringifyFileSize(resource.fileSize), trigram]
    .filter(Boolean)
    .join(" · ");

  const imageUrl = useMemo(() => {
    if (!file || !isImage) return null;
    return URL.createObjectURL(file);
  }, [file, isImage]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // handlers

  async function handleDelete() {
    setMenuAnchorEl(null);
    await deleteResource(resource);
    onBack();
  }

  function handleDownload() {
    setMenuAnchorEl(null);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = resource.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleReattach(files) {
    const pickedFile = files?.[0];
    if (!pickedFile) return;
    setReattaching(true);
    try {
      await reattachResourceFile(resource, pickedFile);
    } finally {
      setReattaching(false);
    }
  }

  // render

  return (
    <BoxFlexVStretch>
      {/* header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          bgcolor: "background.default",
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <IconButton size="small" onClick={onBack}>
          <ArrowBack fontSize="small" />
        </IconButton>
        <Box sx={{ flexGrow: 1, minWidth: 0, ml: 0.5 }}>
          <Typography variant="body2" noWrap>
            {resource.name}
          </Typography>
          {infoS && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {infoS}
            </Typography>
          )}
        </Box>
        <IconButton
          size="small"
          onClick={(e) => setMenuAnchorEl(e.currentTarget)}
        >
          <MoreHoriz fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={() => setMenuAnchorEl(null)}
        >
          <MenuItem onClick={handleDownload} disabled={!file}>
            <ListItemIcon>
              <Download fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={downloadS} />
          </MenuItem>
          <MenuItem onClick={handleDelete}>
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={deleteS} />
          </MenuItem>
        </Menu>
      </Box>

      {/* body */}
      {loading ? (
        <BoxCenter>
          <CircularProgress />
        </BoxCenter>
      ) : fileIsMissing ? (
        <Box
          sx={{
            flexGrow: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            p: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {missingS}
          </Typography>
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            <ContainerFilesSelectorV2
              callToActionLabel={reattachS}
              onFilesChange={handleReattach}
              loading={reattaching}
            />
          </Box>
        </Box>
      ) : isPdf ? (
        <ViewerPdf pdfFile={file} />
      ) : isImage ? (
        <Box
          sx={{
            flexGrow: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            bgcolor: "background.default",
            p: 1,
          }}
        >
          <img
            src={imageUrl}
            alt={resource.name}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </Box>
      ) : (
        <BoxCenter sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {noPreviewS}
          </Typography>
        </BoxCenter>
      )}
    </BoxFlexVStretch>
  );
}
