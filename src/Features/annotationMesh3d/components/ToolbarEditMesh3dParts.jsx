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

import useSelectedMesh3dParts from "../hooks/useSelectedMesh3dParts";
import deleteMesh3dPartsService from "../services/deleteMesh3dPartsService";
import getMesh3dPartsDeleteMessage from "../utils/getMesh3dPartsDeleteMessage";
import getMesh3dPartsDisplay, {
  getMesh3dFaceOrientationLabel,
} from "../utils/getMesh3dPartsDisplay";

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

// Edit toolbar shown instead of the annotation one while faces / edges of the
// annotation's mesh are selected (selection slice parts MESH3D_FACE /
// MESH3D_EDGE): the measures of THAT selection + its deletion. The close
// button returns to the whole-annotation toolbar.
export default function ToolbarEditMesh3dParts({ onDragStart }) {
  const dispatch = useDispatch();

  // strings

  const captionS = "Sélection";
  const backS = "Revenir à l'annotation entière";
  const verticesS = "sommets";
  const moveVertexHintS = "Déplacer (M) : décaler un sommet";

  // data

  const { annotationId, parts, faces, edges, isClosed } =
    useSelectedMesh3dParts();

  // helpers

  const { title, canDelete, deleteLabel, totalSurface, totalLength } =
    getMesh3dPartsDisplay({ faces, edges, isClosed });
  const singleFace = faces.length === 1 ? faces[0] : null;
  // A regular annotation (its parts sit on its displayed conversion) can have
  // a vertex of the selected face moved with « Déplacer ».
  const editor = getActiveThreedEditor();
  const isRegularAnnotation =
    !!annotationId &&
    !editor?.sceneManager?.annotationsManager?.getAnnotationSource?.(
      annotationId
    )?.isMesh3d;

  // handlers

  function handleBack() {
    dispatch(setSelectedPartIds([]));
    dispatch(setSubSelection({ partId: null, partType: null }));
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
            {title}
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

        {singleFace && (
          <Box sx={rowSx}>
            <Typography variant="caption" color="text.secondary">
              {getMesh3dFaceOrientationLabel(singleFace.orientation)}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {singleFace.vertexCount} {verticesS}
            </Typography>
          </Box>
        )}

        {singleFace && isRegularAnnotation && (
          <Box sx={rowSx}>
            <Typography variant="caption" color="text.secondary">
              {moveVertexHintS}
            </Typography>
          </Box>
        )}

        {(faces.length > 0 || edges.length > 0) && (
          <Box sx={{ ...rowSx, justifyContent: "flex-end" }}>
            {faces.length > 0 && (
              <Typography variant="caption" sx={qtySx}>
                {totalSurface.toFixed(2)} m²
              </Typography>
            )}
            {edges.length > 0 && (
              <Typography variant="caption" sx={qtySx}>
                {totalLength.toFixed(2)} ml
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", px: 0.75, py: 0.25 }}>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={deleteLabel}>
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
