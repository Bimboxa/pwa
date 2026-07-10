import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import {
  Box,
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

import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import useSelectedMeshes3d from "../hooks/useSelectedMeshes3d";
import useUpdateMesh3d from "../hooks/useUpdateMesh3d";
import useDeleteMeshes3d from "../hooks/useDeleteMeshes3d";
import useMesh3dLabelPrefix from "../hooks/useMesh3dLabelPrefix";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getMesh3dDisplayLabel from "../utils/getMesh3dDisplayLabel";
import { DEFAULT_MESH3D_COLOR } from "../utils/mesh3dConstants";

// Edit toolbar shown when exactly one maille is selected (mirrors
// ToolbarEditDimension): label override, color, delete.
export default function ToolbarEditMesh3d({ onDragStart }) {
  const dispatch = useDispatch();

  const meshes3d = useSelectedMeshes3d();
  const updateMesh3d = useUpdateMesh3d();
  const deleteMeshes3d = useDeleteMeshes3d();
  const { prefix } = useMesh3dLabelPrefix();

  const mesh3d = meshes3d.length === 1 ? meshes3d[0] : null;
  if (!mesh3d) return null;

  const color = mesh3d.color || DEFAULT_MESH3D_COLOR;
  const displayLabel = getMesh3dDisplayLabel(mesh3d, prefix);

  function handleLabelChange(value) {
    // Empty override reverts to the derived label (prefix + number).
    updateMesh3d(mesh3d.id, { label: value?.trim() ? value.trim() : null });
  }

  function handleColorChange(hex) {
    updateMesh3d(mesh3d.id, { color: hex });
  }

  async function handleDeleteClick() {
    await deleteMeshes3d([mesh3d.id]);
    dispatch(clearSelection());
  }

  return (
    <Paper
      elevation={6}
      sx={{ borderRadius: 2, overflow: "hidden", width: 280 }}
    >
      {/* Top band — label + surface */}
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
        <GridOnIcon fontSize="small" sx={{ color }} />
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {displayLabel}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          — {formatSurfaceM2(mesh3d.surface)}
        </Typography>
      </Stack>

      <Divider />

      {/* Middle band — label override, color */}
      <Box>
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
        <FieldColorV2
          label="Couleur"
          value={color}
          onChange={handleColorChange}
          options={{ showAsSection: true }}
        />
      </Box>

      <Divider />

      {/* Bottom band — actions */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        sx={{ px: 1, py: 0.5 }}
      >
        <Tooltip title="Supprimer la maille">
          <IconButton size="small" color="error" onClick={handleDeleteClick}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
