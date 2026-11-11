import { useDispatch } from "react-redux";

import {
  setSelectedPartIds,
  setSubSelection,
} from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, Button, IconButton, Typography } from "@mui/material";
import {
  ArrowBack as Back,
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import useSelectedMesh3dParts from "../hooks/useSelectedMesh3dParts";
import deleteMesh3dPartsService from "../services/deleteMesh3dPartsService";
import { removeMesh3dPartsOfType } from "../services/selectMesh3dPart";
import getMesh3dPartsDeleteMessage from "../utils/getMesh3dPartsDeleteMessage";
import getMesh3dPartsDisplay, {
  formatMesh3dQty as format,
  getMesh3dFaceOrientationLabel as orientationLabel,
} from "../utils/getMesh3dPartsDisplay";
import { MESH3D_EDGE_PART, MESH3D_FACE_PART } from "../utils/mesh3dPartIds";

// Header of one section of the selection (« Faces » / « Arêtes ») with the
// cross dropping that whole kind from the selection.
function SectionHeader({ label, removeLabel, onRemove }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
        {label}
      </Typography>
      <IconButton size="small" title={removeLabel} onClick={onRemove}>
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
}

function Row({ label, value }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}

// Properties of the selected faces / edges of a mesh annotation (selection
// slice parts MESH3D_FACE / MESH3D_EDGE): measures + deletion. The back
// arrow returns to the annotation's own panel.
export default function PanelPropertiesMesh3dParts() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Sélection";
  const surfaceS = "Surface";
  const verticesS = "Sommets";
  const holesS = "Trous";
  const orientationS = "Orientation";
  const lengthS = "Longueur";
  const totalSurfaceS = "Surface totale";
  const totalLengthS = "Longueur totale";
  const faceDeleteHintS = "Le mesh reste ouvert à l'emplacement de la face.";
  const edgeDeleteHintS =
    "Les deux faces séparées par l'arête sont fusionnées.";
  const edgeLockedHintS =
    "Cette arête sépare deux plans : elle ne peut pas être supprimée.";
  const emptyS = "Aucune face ni arête sélectionnée";
  const facesS = "Faces";
  const edgesS = "Arêtes";
  const removeFacesS = "Retirer les faces de la sélection";
  const removeEdgesS = "Retirer les arêtes de la sélection";

  // data

  const { annotationId, parts, faces, edges, isClosed } =
    useSelectedMesh3dParts();

  // helpers

  const {
    title,
    deletesFaces,
    canDelete,
    deleteLabel,
    totalSurface,
    totalLength,
  } = getMesh3dPartsDisplay({ faces, edges, isClosed });

  // handlers

  function handleBack() {
    dispatch(setSelectedPartIds([]));
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  function handleRemove(partType) {
    removeMesh3dPartsOfType({ dispatch, parts, partType });
  }

  async function handleDelete() {
    try {
      const result = await deleteMesh3dPartsService({
        annotationId,
        parts,
        dispatch,
        editor: getActiveThreedEditor(),
      });
      const message = getMesh3dPartsDeleteMessage(result);
      if (message) dispatch(setToaster({ message, severity: "warning" }));
    } catch (err) {
      console.error("[annotationMesh3d] part delete failed", err);
    }
  }

  // render - no selection

  if (!faces.length && !edges.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {emptyS}
        </Typography>
      </Box>
    );
  }

  // render

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
            {title}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        {faces.length > 0 && (
          <SectionHeader
            label={`${facesS} (${faces.length})`}
            removeLabel={removeFacesS}
            onRemove={() => handleRemove(MESH3D_FACE_PART)}
          />
        )}
        {faces.length === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Row label={surfaceS} value={`${format(faces[0].area)} m²`} />
            <Row label={verticesS} value={faces[0].vertexCount} />
            {faces[0].holeCount > 0 && (
              <Row label={holesS} value={faces[0].holeCount} />
            )}
            <Row
              label={orientationS}
              value={orientationLabel(faces[0].orientation)}
            />
          </Box>
        )}
        {faces.length > 1 && (
          <Row label={totalSurfaceS} value={`${format(totalSurface)} m²`} />
        )}

        {edges.length > 0 && (
          <SectionHeader
            label={`${edgesS} (${edges.length})`}
            removeLabel={removeEdgesS}
            onRemove={() => handleRemove(MESH3D_EDGE_PART)}
          />
        )}
        {edges.length === 1 && (
          <Row label={lengthS} value={`${format(edges[0].length, 3)} m`} />
        )}
        {edges.length > 1 && (
          <Row label={totalLengthS} value={`${format(totalLength, 3)} m`} />
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            disabled={!canDelete}
            onClick={handleDelete}
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
          >
            {deleteLabel}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {deletesFaces
              ? faceDeleteHintS
              : canDelete
                ? edgeDeleteHintS
                : edgeLockedHintS}
          </Typography>
        </Box>
      </Box>
    </BoxFlexVStretch>
  );
}
