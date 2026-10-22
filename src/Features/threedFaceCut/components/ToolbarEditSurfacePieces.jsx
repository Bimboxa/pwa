import { useDispatch } from "react-redux";

import {
  setSelectedPartIds,
  setSubSelection,
} from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import {
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
  DragIndicator as GripIcon,
} from "@mui/icons-material";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import useSelectedSurfacePieces from "../hooks/useSelectedSurfacePieces";
import removeSurfacePiecesService from "../services/removeSurfacePiecesService";

const rowSx = {
  display: "flex",
  alignItems: "center",
  px: 1.25,
  py: 0.25,
  gap: 1,
  borderBottom: "1px solid",
  borderColor: "divider",
};

const qtySx = {
  fontFamily: "monospace",
  color: "warning.main",
  fontWeight: 500,
};

const formatM2 = (m2) =>
  Number(m2).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

// Edit toolbar shown instead of the annotation one while pieces of a surface
// host (lathe, shell, swept profile — selection slice parts SURFACE_PIECE)
// are selected: the area of THAT selection + its deletion, like
// ToolbarEditMesh3dParts for the faces of a mesh. The close button returns
// to the whole-annotation toolbar.
export default function ToolbarEditSurfacePieces({ onDragStart }) {
  const dispatch = useDispatch();

  // strings

  const captionS = "Sélection";
  const titleS = (n) => (n > 1 ? `${n} pièces de surface` : "Pièce de surface");
  const backS = "Revenir à l'annotation entière";
  const cutHintS = "Coupe face (C) : découpe horizontale (H) / verticale (V)";
  const deleteS = (n) =>
    n > 1 ? "Supprimer les pièces (Suppr)" : "Supprimer la pièce (Suppr)";
  const deleteLockedS =
    "Découper (H / V) pour isoler la face avant de la supprimer";
  const failedS = "Pièce introuvable";

  // data

  const { annotationId, pieces, pieceIndices, surface, canDelete } =
    useSelectedSurfacePieces();

  // handlers

  function handleBack() {
    dispatch(setSelectedPartIds([]));
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  async function handleDelete() {
    try {
      const result = await removeSurfacePiecesService({
        editor: getActiveThreedEditor(),
        annotationId,
        pieceIndices,
        dispatch,
      });
      if (!result.ok)
        dispatch(setToaster({ message: failedS, severity: "warning" }));
    } catch (err) {
      console.error("[threedFaceCut] piece delete failed", err);
    }
  }

  // render

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <Paper
        elevation={6}
        sx={{ borderRadius: 3, overflow: "hidden", minWidth: 260 }}
      >
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.25,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            cursor: "grab",
            userSelect: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <GripIcon
            fontSize="small"
            sx={{ color: "text.disabled", flexShrink: 0 }}
          />
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontSize: "0.7rem", flexShrink: 0 }}
          >
            {captionS}
          </Typography>
          <Typography
            variant="body2"
            noWrap
            sx={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: "0.8rem" }}
          >
            {titleS(pieces.length)}
          </Typography>
          <Tooltip title={backS}>
            <IconButton
              size="small"
              onClick={handleBack}
              onMouseDown={(e) => e.stopPropagation()}
              sx={{
                flexShrink: 0,
                color: "text.disabled",
                "&:hover": { bgcolor: "action.hover", color: "text.primary" },
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={rowSx}>
          <Typography variant="caption" color="text.secondary">
            {cutHintS}
          </Typography>
        </Box>

        {surface !== null && (
          <Box sx={{ ...rowSx, justifyContent: "flex-end" }}>
            <Typography variant="caption" sx={qtySx}>
              {formatM2(surface)} m²
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", px: 0.75, py: 0.25 }}>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={canDelete ? deleteS(pieces.length) : deleteLockedS}>
            <span>
              <IconButton
                size="small"
                disabled={!canDelete}
                onClick={handleDelete}
                sx={{
                  color: "text.disabled",
                  "&:hover": { bgcolor: "error.lighter", color: "error.main" },
                }}
              >
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Paper>
    </Box>
  );
}
