import { useDispatch, useSelector } from "react-redux";

import useLegendItems from "Features/legend/hooks/useLegendItems";
import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { setNewAnnotation } from "../annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { Box, Typography } from "@mui/material";

import FormAnnotation from "./FormAnnotation";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxCenter from "Features/layout/components/BoxCenter";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import BlockAnnotation from "./BlockAnnotation";

export default function SectionCreateAnnotation() {
  const dispatch = useDispatch();

  // sttrings

  const wipS = "⚠ Fonctionnalité en cours de développement";

  // strings
  const newS = "Nouveau";

  // data
  const spriteImage = useAnnotationSpriteImage();
  //const annotationTemplates = useLegendItems();
  const annotationTemplates = useAnnotationTemplates();

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const { value: listing } = useSelectedListing();

  console.log("debug_0910 newAnnotation", newAnnotation);

  // handlers

  function handleChange(annotation) {
    dispatch(setNewAnnotation(annotation));
  }

  function handleClose() {
    dispatch(setEnabledDrawingMode(null));
  }

  if (newAnnotation.type === "EDITED_POLYLINE") {
    return (
      <BoxFlexVStretch>
        <BoxCenter sx={{ bgcolor: "warning.light" }}>
          <Typography align="center" color="white" fontWeight="bold">
            {wipS}
          </Typography>
        </BoxCenter>
      </BoxFlexVStretch>
    );
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ width: 1, pl: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {newS}
        </Typography>
      </Box>
      {/* <Box sx={{ display: "flex", justifyContent: "space-between", p: 1 }}>
        <BlockAnnotation
          annotation={newAnnotation}
          spriteImage={spriteImage}
          annotationTemplates={annotationTemplates}
        />

        <IconButtonClose onClose={handleClose} />
      </Box> */}

      <FormAnnotation
        annotation={newAnnotation}
        listing={listing}
        onChange={handleChange}
      />
    </BoxFlexVStretch>
  );
}
