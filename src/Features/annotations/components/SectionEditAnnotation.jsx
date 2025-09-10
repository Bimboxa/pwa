import { useDispatch, useSelector } from "react-redux";

import { setEditedAnnotation } from "../annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setSelectedAnnotationId } from "../annotationsSlice";
import { setIsEditingAnnotation } from "../annotationsSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";

import { Box } from "@mui/material";

import FormAnnotation from "./FormAnnotation";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonClose from "Features/layout/components/IconButtonClose";

export default function SectionEditAnnotation() {
  const dispatch = useDispatch();

  // data

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
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", justifyContent: "end" }}>
        <IconButtonClose onClose={handleClose} />
      </Box>

      <FormAnnotation annotation={annotation} onChange={handleChange} />
    </BoxFlexVStretch>
  );
}
