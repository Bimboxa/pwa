import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import MarkerIcon from "./MarkerIcon";

import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import getAnnotationTemplateIdFromAnnotation from "Features/annotations/utils/getAnnotationTemplateIdFromAnnotation";

export default function MarkerIconNewMarker() {
  // strings

  const selectMarkerS = "Choisissez un style de repère";

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const spriteImage = useAnnotationSpriteImage();

  const annotationTemplates = useAnnotationTemplates();

  // helper - label

  const id = getAnnotationTemplateIdFromAnnotation(newAnnotation);
  const annotationTemplate = annotationTemplates?.find((t) => t.id === id);

  // helper

  const { iconKey, fillColor } = newAnnotation ?? {};

  const isText = newAnnotation?.type === "TEXT";
  const isMarker = newAnnotation?.type === "MARKER";

  // helper - unvalidMarker

  const unvalidMarker = !isText && (!iconKey || !fillColor);

  // render

  if (unvalidMarker)
    return (
      <Box sx={{ bgcolor: "warning.main", p: 1, borderRadius: "4px" }}>
        <Typography variant="body2" color="white" noWrap>
          {selectMarkerS}
        </Typography>
      </Box>
    );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <Typography
        variant="body2"
        align="center"
        noWrap
        sx={{ mb: 1, fontWeight: "bold", bgcolor: "white" }}
      >
        {isText ? "Texte" : annotationTemplate?.label}
      </Typography>
      {isMarker && (
        <MarkerIcon
          spriteImage={spriteImage}
          iconKey={iconKey}
          fillColor={fillColor}
        />
      )}
    </Box>
  );
}
