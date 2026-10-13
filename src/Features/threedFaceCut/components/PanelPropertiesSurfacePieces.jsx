import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import {
  selectSelectedItem,
  selectSelectedPartIds,
  setSelectedPartIds,
  setSubSelection,
} from "Features/selection/selectionSlice";

import { Box, Button, IconButton, Typography } from "@mui/material";
import {
  ArrowBack as Back,
  DeleteOutline as DeleteIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import removeSurfacePiecesService from "../services/removeSurfacePiecesService";
import { getSelectedSurfacePieces } from "../utils/surfacePieceParts";

const formatM2 = (m2) =>
  Number(m2).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

// Properties of the selected pieces of a cut surface host (selection slice
// parts SURFACE_PIECE): area + deletion. The back arrow returns to the
// annotation's own panel.
export default function PanelPropertiesSurfacePieces() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Sélection";
  const titleS = (n) => (n > 1 ? `${n} pièces de surface` : "Pièce de surface");
  const surfaceS = "Surface";
  const deleteS = (n) =>
    n > 1 ? "Supprimer les pièces" : "Supprimer la pièce";
  const hintS =
    "La surface reste ouverte à l'emplacement de la pièce (Suppr). « Supprimer les découpes » dans le panneau de l'annotation la restaure.";
  const failedS = "Pièce introuvable";
  const emptyS = "Aucune pièce sélectionnée";

  // data

  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);
  const pieces = getSelectedSurfacePieces(selectedItem, selectedPartIds);
  const annotationId = pieces.length ? selectedItem.nodeId : null;

  // helpers

  function getSurface() {
    const root =
      getActiveThreedEditor()?.sceneManager?.annotationsManager
        ?.annotationsObjectsMap?.[annotationId];
    if (!root) return null;
    const wanted = new Set(pieces.map((p) => p.pieceIndex));
    let total = 0;
    let found = false;
    root.traverse((mesh) => {
      if (!mesh.isMesh || !wanted.has(mesh.userData?.surfaceCutPiece)) return;
      if (Number.isFinite(mesh.userData.surfaceCutPieceSurface)) {
        total += mesh.userData.surfaceCutPieceSurface;
        found = true;
      }
    });
    return found ? total : null;
  }
  const surface = annotationId ? getSurface() : null;

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
        pieceIndices: pieces.map((p) => p.pieceIndex),
        dispatch,
      });
      if (!result.ok)
        dispatch(setToaster({ message: failedS, severity: "warning" }));
    } catch (err) {
      console.error("[threedFaceCut] piece delete failed", err);
    }
  }

  // render

  if (!pieces.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {emptyS}
        </Typography>
      </Box>
    );
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {captionS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {titleS(pieces.length)}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        {surface !== null && (
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {surfaceS}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {`${formatM2(surface)} m²`}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
          >
            {deleteS(pieces.length)}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {hintS}
          </Typography>
        </Box>
      </Box>
    </BoxFlexVStretch>
  );
}
