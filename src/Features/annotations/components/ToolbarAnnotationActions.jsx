import { useState, useEffect } from "react";

import { Box, IconButton, Tooltip, Divider } from "@mui/material";
import {
  ContentCopy as CloneIcon,
  OpenWith as MoveResizeIcon,
  DeleteOutline as DeleteIcon,
} from "@mui/icons-material";

export default function ToolbarAnnotationActions({
  accentColor,
  onClone,
  cloneDisabled = false,
  cloneTooltip,
  hideClone = false,
  onResize,
  resizeActive = false,
  hideResize = false,
  onDelete,
  hideDelete = false,
  layerChip,
  extraActions,
}) {
  // state

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // helpers

  useEffect(() => {
    if (!deleteConfirm) return;
    const t = setTimeout(() => setDeleteConfirm(false), 2500);
    return () => clearTimeout(t);
  }, [deleteConfirm]);

  // handlers

  function handleDeleteClick() {
    if (deleteConfirm) {
      onDelete();
      setDeleteConfirm(false);
    } else {
      setDeleteConfirm(true);
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1,
        py: 0.5,
        gap: 0.25,
      }}
    >
      {!hideClone && (
        <Tooltip title={cloneTooltip || "Dupliquer"}>
          <span>
            <IconButton
              size="small"
              onClick={onClone}
              disabled={cloneDisabled}
              sx={{
                color: "text.disabled",
                "&:hover": {
                  color: accentColor,
                  bgcolor: accentColor + "18",
                },
              }}
            >
              <CloneIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}

      {!hideResize && (
        <Tooltip title={resizeActive ? "Désactiver déplacer / redimensionner" : "Déplacer / Redimensionner"}>
          <IconButton
            size="small"
            onClick={onResize}
            sx={{
              color: resizeActive ? accentColor : "text.disabled",
              bgcolor: resizeActive ? accentColor + "18" : "transparent",
              "&:hover": {
                color: accentColor,
                bgcolor: accentColor + "18",
              },
            }}
          >
            <MoveResizeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {extraActions}

      <Box sx={{ flex: 1 }} />

      {layerChip}

      {!hideDelete && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Tooltip title={deleteConfirm ? "Confirmer la suppression" : "Supprimer"}>
            <IconButton
              size="small"
              onClick={handleDeleteClick}
              sx={{
                color: deleteConfirm ? "error.main" : "text.disabled",
                bgcolor: deleteConfirm ? "error.lighter" : "transparent",
                "&:hover": {
                  color: "error.main",
                  bgcolor: "error.lighter",
                },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}
