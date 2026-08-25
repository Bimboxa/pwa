import { useDispatch } from "react-redux";

import { triggerSelectionBack } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useSelectedAnnotationPart from "Features/annotations/hooks/useSelectedAnnotationPart";

import { Box, Typography, IconButton } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionAnnotationPropertiesBody from "./SectionAnnotationPropertiesBody";

export default function PanelAnnotationProperties() {
  const dispatch = useDispatch();

  // data

  const annotation = useSelectedAnnotation();
  const part = useSelectedAnnotationPart();
  const hasPart = part && part.kind && part.kind !== "NONE";

  // helpers

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
            {hasPart ? part.captionFr : "Annotation"}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {hasPart ? part.label : label}
          </Typography>
        </Box>
      </Box>

      <SectionAnnotationPropertiesBody />
    </BoxFlexVStretch>
  );
}
