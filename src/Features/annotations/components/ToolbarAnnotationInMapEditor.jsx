import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setEnabledDrawingMode,
  setSelectedAnnotationTemplateId,
} from "Features/mapEditor/mapEditorSlice";
import {
  setNewAnnotation,
  setTempAnnotationTemplateLabel,
} from "../annotationsSlice";

import useResetSelection from "Features/selection/hooks/useResetSelection";
import useAnnotationTemplatesByProject from "../hooks/useAnnotationTemplatesByProject";
import useInitDefaultNewAnnotation from "../hooks/useInitDefaultNewAnnotation";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box, Paper, Typography } from "@mui/material";

import SelectorAnnotationTemplateVariantHorizontal from "./SelectorAnnotationTemplateVariantHorizontal";
import useAnnotationTemplatesBySelectedListing from "../hooks/useAnnotationTemplatesBySelectedListing";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import getNewAnnotationPropsFromAnnotationTemplate from "../utils/getNewAnnotationPropsFromAnnotationTemplate";
import ToolbarNewAnnotationInMapEditor from "./ToolbarNewAnnotationInMapEditor";

export default function ToolbarAnnotationInMapEditor() {
  const dispatch = useDispatch();

  // state

  const [openNew, setOpenNew] = useState(false);

  // data

  const annotationTemplates = useAnnotationTemplatesBySelectedListing({
    sortByLabel: true,
  });
  const spriteImage = useAnnotationSpriteImage();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);
  const resetSelection = useResetSelection();
  const initDefaultNewAnnotation = useInitDefaultNewAnnotation();
  const { value: listing } = useSelectedListing();

  // utils

  //const show = !Boolean(selectedNode?.nodeType);
  const show = true;

  const noTemplates = !annotationTemplates?.length > 0;
  const openNewToolbar = openNew || noTemplates;

  // handlers

  function handleNewClick() {
    initDefaultNewAnnotation();
    dispatch(setTempAnnotationTemplateLabel(""));
    setOpenNew(true);
  }

  function handleAnnotationTemplateClick(annotationTemplate) {
    console.log("annotationTemplate", annotationTemplate);
    resetSelection();
    dispatch(setEnabledDrawingMode(annotationTemplate.type));
    dispatch(
      setNewAnnotation({
        ...newAnnotation,
        ...getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate),
        isFromAnnotation: false,
      })
    );
    dispatch(setTempAnnotationTemplateLabel(annotationTemplate?.label));
    dispatch(setSelectedAnnotationTemplateId(annotationTemplate?.id));
  }

  if (!show) return null;

  return (
    <Paper elevation={12}>
      {!openNewToolbar && (
        <Box>
          <Box sx={{ bgcolor: listing?.color, width: 1, px: 1 }}>
            <Typography sx={{ color: "white" }} variant="caption">
              {listing?.name}
            </Typography>
          </Box>
          <SelectorAnnotationTemplateVariantHorizontal
            annotationTemplates={annotationTemplates}
            spriteImage={spriteImage}
            onClick={handleAnnotationTemplateClick}
            onNewClick={handleNewClick}
          />
        </Box>
      )}

      {openNewToolbar && (
        <ToolbarNewAnnotationInMapEditor onClose={() => setOpenNew(false)} />
      )}
    </Paper>
  );
}
