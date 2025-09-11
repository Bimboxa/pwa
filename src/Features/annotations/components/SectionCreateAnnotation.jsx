import { useDispatch, useSelector } from "react-redux";

import useLegendItems from "Features/legend/hooks/useLegendItems";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import { setNewAnnotation } from "../annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { Box, Typography } from "@mui/material";

import FormAnnotation from "./FormAnnotation";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import BlockAnnotation from "./BlockAnnotation";

export default function SectionCreateAnnotation() {
  const dispatch = useDispatch();

  // strings
  const newS = "Nouveau";

  // data
  const spriteImage = useAnnotationSpriteImage();
  const annotationTemplates = useLegendItems();

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handlers

  function handleChange(annotation) {
    dispatch(setNewAnnotation(annotation));
  }

  function handleClose() {
    dispatch(setEnabledDrawingMode(null));
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ width: 1, pl: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {newS}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", p: 1 }}>
        <BlockAnnotation
          annotation={newAnnotation}
          spriteImage={spriteImage}
          annotationTemplates={annotationTemplates}
        />

        <IconButtonClose onClose={handleClose} />
      </Box>

      <FormAnnotation annotation={newAnnotation} onChange={handleChange} />
    </BoxFlexVStretch>
  );
}
