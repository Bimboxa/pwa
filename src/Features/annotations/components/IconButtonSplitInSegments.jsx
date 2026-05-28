import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useSplitAnnotationsInSegments from "../hooks/useSplitAnnotationsInSegments";
import useDeleteAnnotations from "../hooks/useDeleteAnnotations";
import useListings from "Features/listings/hooks/useListings";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";

import { Box, Button, IconButton, Menu, Tooltip, Typography } from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IconSplitInSegments from "Features/icons/IconSplitInSegments";

export default function IconButtonSplitInSegments({
  annotations,
  accentColor,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Découper en segments";
  const descriptionS = "Remplacer la sélection par des segments isolés";
  const splitS = "Découper";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const splitInSegments = useSplitAnnotationsInSegments();
  const deleteAnnotations = useDeleteAnnotations();
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const polylineTemplates = allTemplates?.filter(
    (t) => resolveDrawingShape(t) === "POLYLINE"
  );

  // Same-template split keeps the source type (STRIP stays a band); the menu
  // below always produces POLYLINE segments from the chosen polyline template.
  const allAreSplittableSameTemplate = annotations?.every((a) =>
    ["POLYLINE", "STRIP"].includes(a.type)
  );

  // handlers

  function handleOpen(event) {
    setAnchorEl(event.currentTarget);
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
      <Tooltip title={titleS}>
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{
            color: "text.disabled",
            "&:hover": {
              color: accentColor,
              bgcolor: accentColor + "18",
            },
          }}
        >
          <IconSplitInSegments fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
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

        {/* Split with target template */}
        <SelectorAnnotationTemplateVariantDense
          selectedAnnotationTemplateId={null}
          onChange={handleTemplateChange}
          annotationTemplates={polylineTemplates}
          listings={listings}
        />
      </Menu>
    </>
  );
}
