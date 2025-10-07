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

  console.log("annotationTemplates", annotationTemplates);

  // handlers

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

  return (
    <Paper elevation={12}>
      {!openNew && (
        <SelectorAnnotationTemplateVariantHorizontal
          annotationTemplates={annotationTemplates}
          spriteImage={spriteImage}
          onClick={handleAnnotationTemplateClick}
          onNewClick={() => setOpenNew(true)}
        />
      )}

      {openNew && (
        <ToolbarNewAnnotationInMapEditor onClose={() => setOpenNew(false)} />
      )}
    </Paper>
  );
}
