import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import { Box, Button, Paper, Typography } from "@mui/material";
import {
  DragIndicator as GripIcon,
  OpenInNew,
  WidgetsOutlined,
} from "@mui/icons-material";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useDeleteAnnotation from "Features/annotations/hooks/useDeleteAnnotation";
import ToolbarAnnotationActions from "Features/annotations/components/ToolbarAnnotationActions";
import ButtonAnnotationBaseMap from "Features/annotations/components/ButtonAnnotationBaseMap";
import ChipLayerSelector from "Features/layers/components/ChipLayerSelector";

import AnnotationMeasurements from "Features/annotations/components/AnnotationMeasurements";

import useBlocks from "../hooks/useBlocks";
import useBlockDefinitionInStore from "../hooks/useBlockDefinitionInStore";
import useOpenBlocksBaseMap from "../hooks/useOpenBlocksBaseMap";

// Toolbar of a selected block instance. An instance carries no geometry of
// its own (it draws its block): the template-centric toolbar does not apply.
// Actions: open the block (to edit its annotations — every instance
// follows), layer, delete. Move / rotate happen on the plan (drag, handle,
// « Déplacer » / « Tourner »).
export default function ToolbarEditBlockInstance({ onDragStart }) {
  const dispatch = useDispatch();

  // strings

  const missingS = "Bloc introuvable";
  const openS = "Modifier le bloc";
  const captionS =
    "Instance d'un bloc : modifiez le bloc pour mettre à jour toutes ses instances.";
  const missingCaptionS = "Le bloc de cette instance a été supprimé.";

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const blocks = useBlocks();
  const deleteAnnotation = useDeleteAnnotation();
  const openBlocksBaseMap = useOpenBlocksBaseMap();
  const definition = useBlockDefinitionInStore(
    selectedAnnotation?.instanceOfBlockId
  );

  // helpers

  const block = blocks?.find(
    (b) => b.id === selectedAnnotation?.instanceOfBlockId
  );
  const blocksLoaded = blocks !== undefined;
  const totals = definition?.totals;

  // handlers

  async function handleDelete() {
    if (!selectedAnnotation?.id) return;
    await deleteAnnotation(selectedAnnotation.id);
    dispatch(clearSelection());
  }

  async function handleOpen() {
    if (!block) return;
    dispatch(clearSelection());
    await openBlocksBaseMap({ block });
  }

  // render

  if (!selectedAnnotation) return null;

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
          <WidgetsOutlined fontSize="small" color="primary" />
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {block?.label ?? (blocksLoaded ? missingS : "")}
          </Typography>
        </Box>

        <Box
          sx={{
            px: 1.25,
            py: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            maxWidth: 300,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {block || !blocksLoaded ? captionS : missingCaptionS}
          </Typography>
          {block && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNew />}
              onClick={handleOpen}
              sx={{ textTransform: "none" }}
            >
              {openS}
            </Button>
          )}
        </Box>

        {/* what this instance counts for: the quantities of its block */}
        {totals && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              px: 1.25,
              py: 0.5,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <AnnotationMeasurements
              surface={totals.surface}
              length={totals.length}
            />
          </Box>
        )}

        <ToolbarAnnotationActions
          hideClone
          hideResize
          onDelete={handleDelete}
          extraActions={<ButtonAnnotationBaseMap annotation={selectedAnnotation} />}
          layerChip={
            <ChipLayerSelector
              annotationIds={[selectedAnnotation.id]}
              annotations={[selectedAnnotation]}
              baseMapId={selectedAnnotation.baseMapId}
            />
          }
        />
      </Paper>
    </Box>
  );
}
