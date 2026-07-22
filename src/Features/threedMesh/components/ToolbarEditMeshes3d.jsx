import { useDispatch } from "react-redux";

import {
  clearSelection,
  setSelectedItem,
} from "Features/selection/selectionSlice";

import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import GridOnIcon from "@mui/icons-material/GridOn";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import MergeIcon from "@mui/icons-material/Merge";

import FieldColorV2 from "Features/form/components/FieldColorV2";

import useSelectedMeshes3d from "../hooks/useSelectedMeshes3d";
import useUpdateMesh3d from "../hooks/useUpdateMesh3d";
import useDeleteMeshes3d from "../hooks/useDeleteMeshes3d";
import mergeMeshes3dService from "../services/mergeMeshes3dService";
import formatSurfaceM2 from "../utils/formatSurfaceM2";

// Edit toolbar shown when several mailles are selected: batch color, merge
// (any planes — the merged maille is multi-face), delete all.
export default function ToolbarEditMeshes3d({ onDragStart }) {
  const dispatch = useDispatch();

  const meshes3d = useSelectedMeshes3d();
  const updateMesh3d = useUpdateMesh3d();
  const deleteMeshes3d = useDeleteMeshes3d();

  if (meshes3d.length < 2) return null;

  const totalSurface = meshes3d.reduce((s, m) => s + (m.surface || 0), 0);
  // Curved mailles have no polygon to union — merge stays a planar operation.
  const hasCurvedMaille = meshes3d.some((m) => m.shell?.positions?.length);

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

  return (
    <Paper
      elevation={6}
      sx={{ borderRadius: 2, overflow: "hidden", width: 280 }}
    >
      {/* Top band — count + total surface */}
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{ px: 1, py: 0.75 }}
      >
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "grab",
            color: "text.disabled",
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <GridOnIcon fontSize="small" color="action" />
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {meshes3d.length} mailles
        </Typography>
        <Typography variant="body2" color="text.secondary">
          — {formatSurfaceM2(totalSurface)}
        </Typography>
      </Stack>

      <Divider />

      {/* Middle band — batch color */}
      <Box>
        <FieldColorV2
          label="Couleur"
          value={meshes3d[0].color}
          onChange={handleColorChange}
          options={{ showAsSection: true }}
        />
      </Box>

      <Divider />

      {/* Bottom band — merge + delete */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1, py: 0.5 }}
      >
        <Button
          size="small"
          startIcon={<MergeIcon fontSize="small" />}
          onClick={handleMergeClick}
          disabled={hasCurvedMaille}
          sx={{ textTransform: "none" }}
        >
          Fusionner
        </Button>
        <Tooltip title="Supprimer les mailles">
          <IconButton size="small" color="error" onClick={handleDeleteClick}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
