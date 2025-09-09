import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "../annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { Box } from "@mui/material";

import FormAnnotation from "./FormAnnotation";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonClose from "Features/layout/components/IconButtonClose";

export default function SectionCreateAnnotation() {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  console.log("newAnnotation", newAnnotation);

  // handlers

  function handleChange(annotation) {
    dispatch(setNewAnnotation(annotation));
  }

  function handleClose() {
    dispatch(setEnabledDrawingMode(null));
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", justifyContent: "end" }}>
        <IconButtonClose onClose={handleClose} />
      </Box>

      <FormAnnotation annotation={newAnnotation} onChange={handleChange} />
    </BoxFlexVStretch>
  );
}
