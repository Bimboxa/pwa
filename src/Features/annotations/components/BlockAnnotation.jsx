import MarkerIcon from "Features/markers/components/MarkerIcon";

import { Box, Typography } from "@mui/material";

import getAnnotationTemplateIdFromAnnotation from "../utils/getAnnotationTemplateIdFromAnnotation";

export default function BlockAnnotation({
  annotation,
  spriteImage,
  annotationTemplates,
}) {
  // helpers

  const templateId = getAnnotationTemplateIdFromAnnotation(annotation);
  const template = annotationTemplates?.find((t) => t.id === templateId);

  const label = template?.label ?? "Libellé à définir";

  // helpers - marker icon
  const iconKey = template?.iconKey;
  const fillColor = template?.fillColor;

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <MarkerIcon
        iconKey={iconKey}
        spriteImage={spriteImage}
        size={24}
        fillColor={fillColor}
      />
      <Typography sx={{ ml: 1 }}>{label}</Typography>
    </Box>
  );
}
