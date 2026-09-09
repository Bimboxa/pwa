import { useDispatch } from "react-redux";

import { triggerSelectionBack } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

import { Box, Typography, IconButton } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionAnnotationLabelContent from "./SectionAnnotationLabelContent";

// Right-panel properties of a selected annotation label (ANNOTATION_LABEL
// selection): the former "Etiquette" tab of the annotation panel. Back
// selects the parent annotation (triggerSelectionBack).
export default function PanelAnnotationLabelProperties() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Etiquette";
  const noSelectionS = "Aucune étiquette sélectionnée";

  // data

  const annotation = useSelectedAnnotation();

  // helpers

  const label = annotation?.label || "Annotation";

  // render - no selection

  if (!annotation) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {noSelectionS}
        </Typography>
      </Box>
    );
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          pl: 1,
        }}
      >
        <IconButton onClick={() => dispatch(triggerSelectionBack())}>
          <Back />
        </IconButton>

        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {captionS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {label}
          </Typography>
        </Box>
      </Box>

      <BoxFlexVStretch sx={{ overflowY: "auto" }}>
        <SectionAnnotationLabelContent annotation={annotation} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
