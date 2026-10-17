import { useState } from "react";
import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useSplitAnnotationsInSegments from "Features/annotations/hooks/useSplitAnnotationsInSegments";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import { Box, Button, Typography } from "@mui/material";

import CommandButton from "../../components/CommandButton";
import MenuPickAnnotationTemplate from "../../components/MenuPickAnnotationTemplate";
import { getTargets } from "../../utils/selectionCommandState";
import { SPLIT_IN_SEGMENTS_TYPES } from "./splitInSegmentsCommand";

// Toolbar button of « Découper en segments » (commandsToolbar): menu with the
// same-template split and a polyline template picker.
export default function ButtonSplitInSegments({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  const dispatch = useDispatch();
  const annotations = getTargets(ctx, SPLIT_IN_SEGMENTS_TYPES);

  // strings

  const titleS = "Découper en segments";
  const descriptionS = "Remplacer la sélection par des segments isolés";
  const splitS = "Découper";

  // data

  const splitInSegments = useSplitAnnotationsInSegments();
  const deleteAnnotations = useDeleteAnnotations();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const filterPolylineTemplate = (t) => resolveDrawingShape(t) === "POLYLINE";

  // Same-template split keeps the source type (STRIP stays a band); the menu
  // below always produces POLYLINE segments from the chosen polyline template.
  const allAreSplittableSameTemplate = annotations?.every((a) =>
    ["POLYLINE", "STRIP"].includes(a.type)
  );

  // handlers

  function handleOpen(event, anchor) {
    setAnchorEl(anchor);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleSplit(annotationTemplateId, outputType = "POLYLINE") {
    try {
      await splitInSegments({ annotations, annotationTemplateId, outputType });
      const ids = annotations.map((a) => a.id).filter(Boolean);
      await deleteAnnotations(ids);
      dispatch(clearSelection());
    } catch (e) {
      console.error("[splitInSegments]", e);
    } finally {
      handleClose();
    }
  }

  async function handleSplitSameTemplate() {
    const templateId = annotations?.[0]?.annotationTemplateId;
    if (!templateId) return;
    // Preserve bands: any STRIP in the selection keeps its STRIP segments;
    // the template menu below always forces POLYLINE output.
    const outputType = annotations?.some((a) => a.type === "STRIP")
      ? "STRIP"
      : "POLYLINE";
    await handleSplit(templateId, outputType);
  }

  async function handleTemplateChange(annotationTemplateId) {
    await handleSplit(annotationTemplateId, "POLYLINE");
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={{ ...state, active: open }}
        onClick={handleOpen}
      />

      <MenuPickAnnotationTemplate
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        filterTemplate={filterPolylineTemplate}
        onChange={handleTemplateChange}
      >
        {/* Title */}
        <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {titleS}
          </Typography>
        </Box>

        {/* Split with same template section */}
        <Box sx={{ bgcolor: "background.default", p: 2 }}>
          <Box
            sx={{
              bgcolor: "background.paper",
              borderRadius: 1,
              p: 1.5,
            }}
          >
            <Typography variant="body2">{descriptionS}</Typography>
            <Button
              variant="contained"
              fullWidth
              size="small"
              disabled={!allAreSplittableSameTemplate}
              onClick={handleSplitSameTemplate}
              sx={{ mt: 1 }}
            >
              {splitS}
            </Button>
          </Box>
        </Box>
      </MenuPickAnnotationTemplate>
    </>
  );
}
