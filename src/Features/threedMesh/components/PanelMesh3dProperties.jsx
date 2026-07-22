import { useDispatch } from "react-redux";

import {
  clearSelection,
  setSelectedItem,
} from "Features/selection/selectionSlice";

import { Box, Button, IconButton, Typography } from "@mui/material";
import {
  ArrowBack as Back,
  Delete as DeleteIcon,
  GridOn as GridOnIcon,
  Merge as MergeIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import useSelectedMeshes3d from "../hooks/useSelectedMeshes3d";
import useUpdateMesh3d from "../hooks/useUpdateMesh3d";
import useDeleteMeshes3d from "../hooks/useDeleteMeshes3d";
import useMesh3dLabelPrefix from "../hooks/useMesh3dLabelPrefix";
import mergeMeshes3dService from "../services/mergeMeshes3dService";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getMesh3dDisplayLabel from "../utils/getMesh3dDisplayLabel";
import { DEFAULT_MESH3D_COLOR } from "../utils/mesh3dConstants";

// Properties panel for the selected maille(s) — MESH3D nodes in the 3D viewer.
// Single selection mirrors ToolbarEditMesh3d (label override, color, delete);
// multi selection mirrors ToolbarEditMeshes3d (batch color, merge, delete).
export default function PanelMesh3dProperties() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Sélection";
  const deleteS = "Supprimer";
  const mergeS = "Fusionner";

  // data

  const meshes3d = useSelectedMeshes3d();
  const updateMesh3d = useUpdateMesh3d();
  const deleteMeshes3d = useDeleteMeshes3d();
  const { prefix } = useMesh3dLabelPrefix();

  // helpers

  const isMulti = meshes3d.length > 1;
  const mesh3d = meshes3d.length === 1 ? meshes3d[0] : null;
  const totalSurface = meshes3d.reduce((s, m) => s + (m.surface || 0), 0);
  // Curved mailles have no polygon to union — merge stays a planar operation.
  const hasCurvedMaille = meshes3d.some((m) => m.shell?.positions?.length);

  const color =
    (mesh3d ? mesh3d.color : meshes3d[0]?.color) || DEFAULT_MESH3D_COLOR;
  const displayLabel = mesh3d ? getMesh3dDisplayLabel(mesh3d, prefix) : null;
  const title = mesh3d ? displayLabel : `${meshes3d.length} mailles`;

  // handlers

  function handleBack() {
    dispatch(clearSelection());
  }

  function handleLabelChange(value) {
    // Empty override reverts to the derived label (prefix + number).
    updateMesh3d(mesh3d.id, { label: value?.trim() ? value.trim() : null });
  }

  function handleColorChange(hex) {
    meshes3d.forEach((m) => updateMesh3d(m.id, { color: hex }));
  }

  async function handleMergeClick() {
    const survivorId = await mergeMeshes3dService(meshes3d.map((m) => m.id));
    if (survivorId) {
      dispatch(
        setSelectedItem({
          id: survivorId,
          nodeId: survivorId,
          type: "NODE",
          nodeType: "MESH3D",
        })
      );
    }
  }

  async function handleDeleteClick() {
    await deleteMeshes3d(meshes3d.map((m) => m.id));
    dispatch(clearSelection());
  }

  // render - no selection

  if (meshes3d.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucune maille sélectionnée
        </Typography>
      </Box>
    );
  }

  // render

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <GridOnIcon fontSize="small" sx={{ color, mx: 1 }} />
        <Box>
          <Typography variant="caption" color="text.secondary">
            {captionS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {title} — {formatSurfaceM2(totalSurface)}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          p: 1,
          overflow: "auto",
        }}
      >
        {/* Card 1: label (single only) + color */}
        <WhiteSectionGeneric>
          {mesh3d && (
            <FieldTextV2
              label="Label"
              value={mesh3d.label ?? ""}
              onChange={handleLabelChange}
              options={{
                showAsField: true,
                placeholder: displayLabel,
                changeOnBlur: true,
                hideMic: true,
              }}
            />
          )}
          <FieldColorV2
            label="Couleur"
            value={color}
            onChange={handleColorChange}
            options={{ showAsSection: true }}
          />
        </WhiteSectionGeneric>

        {/* Card 2: actions */}
        <WhiteSectionGeneric>
          {isMulti && (
            <Button
              startIcon={<MergeIcon />}
              onClick={handleMergeClick}
              disabled={hasCurvedMaille}
              fullWidth
              size="small"
              sx={{ mb: 1 }}
            >
              {mergeS}
            </Button>
          )}
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteClick}
            fullWidth
            size="small"
          >
            {deleteS}
          </Button>
        </WhiteSectionGeneric>
      </Box>
    </BoxFlexVStretch>
  );
}
