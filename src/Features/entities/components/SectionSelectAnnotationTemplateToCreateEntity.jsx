import { useDispatch, useSelector } from "react-redux";

import {
  setEnabledDrawingMode,
  setSelectedAnnotationTemplateId,
} from "Features/mapEditor/mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import useAnnotationTemplatesBySelectedListing from "Features/annotations/hooks/useAnnotationTemplatesBySelectedListing";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListAnnotationTemplates from "Features/annotations/components/ListAnnotationTemplates";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

export default function SectionSelectAnnotationTemplateToCreateEntity({
  onSelected,
}) {
  const dispatch = useDispatch();

  // strings

  const createS = "Ajoutez un objet";

  // data

  const annotationTemplates = useAnnotationTemplatesBySelectedListing();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handlers

  function handleClick(annotationTemplate) {
    dispatch(setEnabledDrawingMode(annotationTemplate.type));

    dispatch(
      setNewAnnotation({
        ...newAnnotation,
        ...getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate),
        isFromAnnotation: false,
      })
    );

    dispatch(setSelectedAnnotationTemplateId(annotationTemplate?.id)); // need that... TO DO : remove complexity in MARKER to get annotation template.

    onSelected(annotationTemplate);
  }
  // const
  return (
    <BoxFlexVStretch sx={{ width: 1 }}>
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {createS}
        </Typography>
      </Box>

      <ListAnnotationTemplates
        annotationTemplates={annotationTemplates}
        onClick={handleClick}
      />
    </BoxFlexVStretch>
  );
}
