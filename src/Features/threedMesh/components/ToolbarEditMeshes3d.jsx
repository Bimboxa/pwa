import { useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedItems,
  setSelectedItems,
} from "Features/selection/selectionSlice";

import {
  Box,
  Button,
  ButtonBase,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import GridOnIcon from "@mui/icons-material/GridOn";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import MergeIcon from "@mui/icons-material/Merge";

import FieldColorV2 from "Features/form/components/FieldColorV2";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import PanelFooter from "Features/layout/components/PanelFooter";

import useSelectedMeshes3d from "../hooks/useSelectedMeshes3d";
import useUpdateMesh3d from "../hooks/useUpdateMesh3d";
import useDeleteMeshes3d from "../hooks/useDeleteMeshes3d";
import useMesh3dSurfaceDecimals from "../hooks/useMesh3dSurfaceDecimals";
import mergeMeshes3dService from "../services/mergeMeshes3dService";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getMeshes3dContrastedColors, {
  getContrastedShades,
} from "../utils/getMeshes3dContrastedColors";

// Edit toolbar shown when several mailles are selected: batch color, merge
// (any planes — the merged maille is multi-face), delete all.
// Color row: the picker only CHOOSES the color; two buttons apply it —
// « Couleur homogène » (the same color on every maille) and « Couleur
// contrastée » (shades of it, touching mailles never alike).
// `embedded`: « Mailles » section of a mixed selection (annotations +
// mailles), stacked under ToolbarEditAnnotations — shown from 1 maille and
// stretched to the popper width.
export default function ToolbarEditMeshes3d({ onDragStart, embedded = false }) {
  const dispatch = useDispatch();

  const selectedItems = useSelector(selectSelectedItems);

  const meshes3d = useSelectedMeshes3d();
  const updateMesh3d = useUpdateMesh3d();
  const deleteMeshes3d = useDeleteMeshes3d();
  const { surfaceDecimals } = useMesh3dSurfaceDecimals();

  // Resize (bottom band, same mechanics as PopperMapListings). The toolbar
  // is centred in its popper: widthFactor 2 keeps the handle under the cursor.
  const paperRef = useRef(null);
  const {
    size,
    isAutoHeight,
    handleResizeMouseDown,
    fitContent,
    reset: resetSize,
  } = usePanelResize({ paperRef, widthFactor: 2 });

  // Color chosen in the picker, not applied yet (null: the first maille's).
  const [pickedColor, setPickedColor] = useState(null);

  if (meshes3d.length < (embedded ? 1 : 2)) return null;

  const color = pickedColor ?? meshes3d[0].color;
  const shades = getContrastedShades(color);

  // The other selected items (annotations of a mixed selection) survive the
  // maille actions.
  const otherItems = selectedItems.filter(
    (it) => !(it?.type === "NODE" && it?.nodeType === "MESH3D")
  );
  const countLabel = `${meshes3d.length} maille${meshes3d.length > 1 ? "s" : ""}`;

  const totalSurface = meshes3d.reduce((s, m) => s + (m.surface || 0), 0);
  // Curved mailles have no polygon to union — merge stays a planar operation.
  const hasCurvedMaille = meshes3d.some((m) => m.shell?.positions?.length);

  function handleApplyHomogeneousColor() {
    meshes3d.forEach((m) => updateMesh3d(m.id, { color }));
  }

  function handleApplyContrastedColor() {
    const colors = getMeshes3dContrastedColors(meshes3d, color);
    meshes3d.forEach((m) => updateMesh3d(m.id, { color: colors.get(m.id) }));
  }

  async function handleMergeClick() {
    const survivorId = await mergeMeshes3dService(meshes3d.map((m) => m.id));
    if (survivorId) {
      dispatch(
        setSelectedItems([
          ...otherItems,
          {
            id: survivorId,
            nodeId: survivorId,
            type: "NODE",
            nodeType: "MESH3D",
          },
        ])
      );
    }
  }

  // Empties the mailles side of the selection (the mailles are kept).
  function handleClearMeshesSelection() {
    dispatch(setSelectedItems(otherItems));
  }

  async function handleDeleteClick() {
    await deleteMeshes3d(meshes3d.map((m) => m.id));
    dispatch(setSelectedItems(otherItems));
  }

  return (
    <Paper
      ref={paperRef}
      elevation={6}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        // Embedded: follows the popper width until it is resized on its own.
        ...(embedded && !size
          ? { alignSelf: "stretch", minWidth: 280 }
          : { alignSelf: "center", width: size?.width ?? 280 }),
        ...(size && { height: size.height }),
      }}
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
        {/* Same header type as ToolbarEditAnnotations */}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, fontSize: "0.8rem" }}
        >
          {countLabel}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: "0.8rem" }}
        >
          — {formatSurfaceM2(totalSurface, surfaceDecimals)}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Vider la sélection de mailles">
          <IconButton size="small" onClick={handleClearMeshesSelection}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Divider />

      {/* Middle band — batch color (takes the slack once resized) */}
      <Box sx={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
        <FieldColorV2
          label="Couleur"
          value={color}
          onChange={setPickedColor}
          options={{ showAsSection: true, swatchNextToLabel: true }}
          endAction={
            <>
              <ButtonApplyColor
                title="Couleur homogène"
                colors={[color, color, color]}
                onClick={handleApplyHomogeneousColor}
              />
              <ButtonApplyColor
                title="Couleur contrastée"
                colors={[shades[1], shades[0], shades[2]]}
                onClick={handleApplyContrastedColor}
              />
            </>
          }
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
          disabled={hasCurvedMaille || meshes3d.length < 2}
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

      {/* Bottom band: "auto" height + resize handle */}
      <PanelFooter
        onResizeMouseDown={handleResizeMouseDown}
        onResetSize={resetSize}
        onFitContent={fitContent}
        isAutoHeight={isAutoHeight}
      />
    </Paper>
  );
}

// Apply button of the color row: a swatch previewing what the click gives
// (three bands — the same color, or three shades of it).
function ButtonApplyColor({ title, colors, onClick }) {
  return (
    <Tooltip title={title}>
      <ButtonBase
        onClick={onClick}
        aria-label={title}
        sx={{
          display: "flex",
          width: 36,
          height: 24,
          borderRadius: 1,
          overflow: "hidden",
          border: "2px solid",
          borderColor: "divider",
          transition: "transform 0.2s",
          "&:hover": { transform: "scale(1.1)" },
        }}
      >
        {colors.map((c, i) => (
          <Box key={i} sx={{ flex: 1, alignSelf: "stretch", bgcolor: c }} />
        ))}
      </ButtonBase>
    </Tooltip>
  );
}
