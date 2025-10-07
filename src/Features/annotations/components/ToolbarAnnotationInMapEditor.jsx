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

import useAnnotationTemplatesByProject from "../hooks/useAnnotationTemplatesByProject";

import { Box, Paper } from "@mui/material";

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

  const annotationTemplates = useAnnotationTemplatesBySelectedListing();
  const spriteImage = useAnnotationSpriteImage();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);

  // utils

  const show = !Boolean(selectedNode?.nodeType);
  const noTemplates = !annotationTemplates?.length > 0;
  const openNewToolbar = openNew || noTemplates;

  // handlers

  function handleNewClick() {
    dispatch(setNewAnnotation(null));
    dispatch(setTempAnnotationTemplateLabel(""));
    setOpenNew(true);
  }

  function handleAnnotationTemplateClick(annotationTemplate) {
    console.log("annotationTemplate", annotationTemplate);
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
        <SelectorAnnotationTemplateVariantHorizontal
          annotationTemplates={annotationTemplates}
          spriteImage={spriteImage}
          onClick={handleAnnotationTemplateClick}
          onNewClick={handleNewClick}
        />
      )}

      {openNewToolbar && (
        <ToolbarNewAnnotationInMapEditor onClose={() => setOpenNew(false)} />
      )}
    </Paper>
  );
}
