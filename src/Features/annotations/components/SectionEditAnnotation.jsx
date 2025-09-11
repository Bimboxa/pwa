import { useDispatch, useSelector } from "react-redux";

import { setEditedAnnotation } from "../annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setSelectedAnnotationId } from "../annotationsSlice";
import { setIsEditingAnnotation } from "../annotationsSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import useLegendItems from "Features/legend/hooks/useLegendItems";

import { Box } from "@mui/material";

import BlockAnnotation from "./BlockAnnotation";
import FormAnnotation from "./FormAnnotation";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonClose from "Features/layout/components/IconButtonClose";

export default function SectionEditAnnotation() {
  const dispatch = useDispatch();

  // data
  const spriteImage = useAnnotationSpriteImage();
  const annotationTemplates = useLegendItems();

  const editedAnnotation = useSelector((s) => s.annotations.editedAnnotation);
  const selectedAnnotation = useSelectedAnnotation();
  const isEditingAnnotation = useSelector(
    (s) => s.annotations.isEditingAnnotation
  );

  // helper

  const annotation = isEditingAnnotation
    ? editedAnnotation
    : selectedAnnotation;

  // handlers

  function handleChange(annotation) {
    dispatch(setEditedAnnotation(annotation));
    dispatch(setIsEditingAnnotation(true));
  }

  function handleClose() {
    dispatch(setSelectedAnnotationId(null));
    dispatch(setEditedAnnotation({}));
    dispatch(setIsEditingAnnotation(false));
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", justifyContent: "space-between", p: 1 }}>
        <BlockAnnotation
          annotation={annotation}
          spriteImage={spriteImage}
          annotationTemplates={annotationTemplates}
        />

        <IconButtonClose onClose={handleClose} />
      </Box>

      <FormAnnotation annotation={annotation} onChange={handleChange} />
    </BoxFlexVStretch>
  );
}
