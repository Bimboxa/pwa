import { Box, Typography, Divider } from "@mui/material";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import FieldColorVariantToolbar from "Features/form/components/FieldColorVariantToolbar";
import FieldOptionKey from "Features/form/components/FieldOptionKey";
import FieldAnnotationPreview from "./FieldAnnotationPreview";
import ButtonAnnotationTemplate from "./ButtonAnnotationTemplate";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function PanelAnnotationProperties() {
  // data

  const annotation = useSelectedAnnotation();



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
      <Box sx={{ width: 1, p: 1 }}>
        <FieldAnnotationPreview annotation={annotation} imageHeight={200} />
      </Box>

      <Box sx={{ p: 1, width: 1 }}>
        <ButtonAnnotationTemplate annotation={annotation} bgcolor="white" fullWidth />
      </Box>



    </BoxFlexVStretch>
  );
}
