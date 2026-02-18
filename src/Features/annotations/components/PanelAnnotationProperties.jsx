import { useDispatch } from "react-redux";

import { triggerSelectionBack } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import { Box, Typography, Divider, IconButton, } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import FieldColorVariantToolbar from "Features/form/components/FieldColorVariantToolbar";
import FieldOptionKey from "Features/form/components/FieldOptionKey";
import FieldAnnotationPreview from "./FieldAnnotationPreview";
import ButtonAnnotationTemplate from "./ButtonAnnotationTemplate";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionAnnotationQties from "./SectionAnnotationQties";

export default function PanelAnnotationProperties() {
  const dispatch = useDispatch();

  // data

  const annotation = useSelectedAnnotation();

  // helper

  const label = annotation?.label || "Annotation";



  // render - no selection

  if (!annotation) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucune annotation sélectionnée
        </Typography>
      </Box>
    );
  }

  // render

  return (
    <BoxFlexVStretch>

      <Box sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        p: 0.5,
        pl: 1,
      }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton onClick={() => dispatch(triggerSelectionBack())}>
            <Back />
          </IconButton>

          <Typography variant="body2" sx={{ fontWeight: "bold", ml: 1 }}>{label}</Typography>
        </Box>

        {/* <IconButtonMoreActionsAnnotationTemplate annotationTemplate={selectedAnnotationTemplate} /> */}
      </Box>

      <Box sx={{ width: 1, p: 1 }}>
        <FieldAnnotationPreview annotation={annotation} imageHeight={200} />
      </Box>

      <SectionAnnotationQties annotation={annotation} />

      <Box sx={{ p: 1, width: 1 }}>
        <ButtonAnnotationTemplate annotation={annotation} bgcolor="white" fullWidth />
      </Box>



    </BoxFlexVStretch>
  );
}
