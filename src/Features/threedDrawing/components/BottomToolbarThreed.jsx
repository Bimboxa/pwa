import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import {
  setMoveModeActive,
  setMoveSelectedAnnotationId,
  setMoveSubSelectionTarget,
  toggleClippingPlaneEditing,
} from "Features/threedEditor/threedEditorSlice";

import { Box, Button, Divider, Paper, Stack, Tooltip } from "@mui/material";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import ContentCutIcon from "@mui/icons-material/ContentCut";

import ButtonDrawThreed from "./ButtonDrawThreed";
import ButtonDimensionThreed from "Features/threedDimensions/components/ButtonDimensionThreed";

// Floating bottom toolbar for the main 3D viewer. Three states:
//   - Move mode active → hidden (MoveGizmoThreed owns the bottom UI).
//   - Selection present (annotation, vertex or edge) → label of the
//     selected entity + a "Déplacer" button that switches to move mode
//     pre-targeted on that entity.
//   - Nothing selected → drawing tools (ButtonDrawThreed).
export default function BottomToolbarThreed() {
  const dispatch = useDispatch();

  const moveActive = useSelector((s) => s.threedEditor.moveMode.active);
  const clippingEditing = useSelector(
    (s) => s.threedEditor.clippingPlane.editing
  );
  const subSelection = useSelector((s) => s.threedEditor.subSelection);
  const annotationSelectionId = useSelector((s) => {
    const items = s.selection.selectedItems || [];
    const ann = items.find(
      (i) => i.type === "NODE" && i.nodeType === "ANNOTATION"
    );
    return ann?.nodeId || ann?.id || null;
  });

  // useLiveQuery must be called unconditionally — pass a query that returns
  // null when there is no annotation to look up.
  const annotation = useLiveQuery(
    () =>
      annotationSelectionId ? db.annotations.get(annotationSelectionId) : null,
    [annotationSelectionId]
  );

  if (moveActive) return null;

  const hasSubSelection = !!subSelection?.annotationId;
  const hasAnnotationSelection = !!annotationSelectionId;
  const hasSelection = hasSubSelection || hasAnnotationSelection;

  const annotationName =
    annotation?.name || annotation?.title || annotation?.type || "Annotation";

  const label = hasSubSelection
    ? subSelection.kind === "VERTEX"
      ? `Vertex N°${(subSelection.vertexIndex ?? 0) + 1}`
      : `Arête N°${(subSelection.vertexIndex ?? 0) + 1}-${
          (subSelection.vertexIndexB ?? 0) + 1
        }`
    : annotationName;

  const handleMove = () => {
    if (hasSubSelection) {
      dispatch(
        setMoveSubSelectionTarget({
          annotationId: subSelection.annotationId,
          kind: subSelection.kind,
          pointIds: subSelection.pointIds || [],
          vertexIndex: subSelection.vertexIndex,
          vertexIndexB: subSelection.vertexIndexB,
        })
      );
    } else if (hasAnnotationSelection) {
      dispatch(setMoveSelectedAnnotationId(annotationSelectionId));
    } else {
      return;
    }
    dispatch(setMoveModeActive(true));
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        px: 1,
        py: 0.5,
        borderRadius: "10px",
        zIndex: 10,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {hasSelection ? (
          <>
            <Box sx={{ fontSize: 13, fontWeight: 500, px: 0.5 }}>{label}</Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<OpenWithIcon sx={{ fontSize: 18 }} />}
              onClick={handleMove}
              sx={{ textTransform: "none", borderRadius: "8px" }}
            >
              Déplacer
            </Button>
          </>
        ) : (
          <>
            <ButtonDrawThreed />
            <ButtonDimensionThreed />
          </>
        )}
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title="Plan de coupe">
          <Button
            size="small"
            variant={clippingEditing ? "contained" : "outlined"}
            color={clippingEditing ? "secondary" : "inherit"}
            startIcon={<ContentCutIcon sx={{ fontSize: 18 }} />}
            onClick={() => dispatch(toggleClippingPlaneEditing())}
            sx={{ textTransform: "none", borderRadius: "8px" }}
          >
            Coupe
          </Button>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
